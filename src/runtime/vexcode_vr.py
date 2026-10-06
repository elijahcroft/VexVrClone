"""Python side of the robot API, matching VEXcode VR's command names.

Student code is run through transform.py first, so every call here may be
awaited. Device methods that take time return JS Promises from the `vrjs`
bridge (see src/runtime/bridge.ts); everything else returns plain values.

All distances cross the bridge in mm, angles in degrees, times in seconds.
"""

import asyncio
import sys
import traceback

import vrjs

# ---------------------------------------------------------------- constants


class _Const(str):
    """A named constant that prints as its name, like VEXcode's enums."""

    def __repr__(self):
        return str(self)


for _n in (
    "FORWARD REVERSE LEFT RIGHT "
    "MM INCHES DEGREES PERCENT SECONDS MSEC X Y "
    "UP DOWN BOOST DROP "
    "RED GREEN BLUE BLACK NONE "
    "EXTRA_THIN THIN MEDIUM WIDE EXTRA_WIDE"
).split():
    globals()[_n] = _Const(_n)
del _n


def _mm(value, units):
    return value * 25.4 if units == INCHES else value


def _from_mm(value, units):
    return value / 25.4 if units == INCHES else value


def _seconds(value, units):
    return value / 1000 if units == MSEC else value


# ------------------------------------------------------------ program state


class ProgramStopped(Exception):
    pass


class _State:
    def __init__(self):
        self.stopped = False
        self.tasks = set()
        self.handlers = {}  # event name -> list of callbacks
        self.stop_future = None
        self.last_yield = 0.0
        self.error_reported = False


_state = _State()


async def _vr_call(f, *args, **kwargs):
    if _state.stopped:
        raise ProgramStopped()
    result = f(*args, **kwargs)
    if hasattr(type(result), "__await__"):
        result = await result
    return result


async def _vr_tick():
    if _state.stopped:
        raise ProgramStopped()
    now = vrjs.now()
    if now - _state.last_yield > 16:
        _state.last_yield = now
        await vrjs.yield_frame()
        if _state.stopped:
            raise ProgramStopped()


def _vr_highlight(block_id):
    return vrjs.highlight(block_id)


def _report_error(exc):
    if _state.error_reported:
        return
    _state.error_reported = True
    # Show only frames from the student's code.
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == "main.py"]
    line = f"Line {frames[-1].lineno}: " if frames else ""
    if isinstance(exc, SyntaxError):
        line = f"Line {exc.lineno}: "
        message = f"SyntaxError: {exc.msg}"
    else:
        message = "".join(traceback.format_exception_only(type(exc), exc)).strip()
    vrjs.report_error(line + message, frames[-1].lineno if frames else (getattr(exc, "lineno", None) or 0))


async def _run_thread(f, args):
    try:
        await _vr_call(f, *args)
    except (ProgramStopped, asyncio.CancelledError):
        pass
    except BaseException as exc:
        _report_error(exc)
        stop_project()


class _Thread:
    def __init__(self, task):
        self._task = task

    def stop(self):
        self._task.cancel()


def _spawn(f, *args):
    task = asyncio.ensure_future(_run_thread(f, args))
    _state.tasks.add(task)
    task.add_done_callback(_state.tasks.discard)
    return task


def vr_thread(f, *args):
    return _Thread(_spawn(f, *args))


def stop_project():
    if _state.stopped:
        return
    _state.stopped = True
    for task in list(_state.tasks):
        task.cancel()
    if _state.stop_future and not _state.stop_future.done():
        _state.stop_future.set_result(None)
    vrjs.on_program_stopped()


def _on(event, callback, *args):
    _state.handlers.setdefault(event, []).append((callback, args))


def _vr_dispatch(event):
    """Called from JS when a sensor event fires (bumper pressed, etc.)."""
    if _state.stopped:
        return
    for callback, args in _state.handlers.get(event, []):
        _spawn(callback, *args)


async def wait(duration, units=SECONDS):
    await vrjs.wait(_seconds(duration, units))


# -------------------------------------------------------------- the brain


class _Timer:
    def time(self, units=SECONDS):
        t = vrjs.timer_time()
        return t * 1000 if units == MSEC else t

    def reset(self):
        vrjs.timer_reset()


class Brain:
    def __init__(self, *_):
        self.timer = _Timer()
        self._precision = 0
        # Older projects use brain.screen.print(...) and friends.
        self.screen = self

    def next_row(self):
        self.new_line()

    def clear_screen(self):
        self.clear()

    def print(self, *values, precision=None):
        p = self._precision if precision is None else precision
        parts = [f"{v:.{p}f}" if isinstance(v, float) else str(v) for v in values]
        vrjs.console_print(" ".join(parts))

    def new_line(self):
        vrjs.console_new_line()

    def clear(self):
        vrjs.console_clear()

    def set_print_color(self, color):
        vrjs.console_set_color(str(color))

    def set_print_precision(self, precision):
        self._precision = precision

    def timer_time(self, units=SECONDS):
        return self.timer.time(units)

    def timer_reset(self):
        self.timer.reset()

    def timer_event(self, callback, delay):
        async def fire():
            await wait(delay, MSEC)
            await _vr_call(callback)

        vr_thread(fire)


# ------------------------------------------------------------- drivetrain


class Drivetrain:
    def __init__(self, name="drivetrain", *_):
        self._dt = vrjs.device(name)

    def drive(self, direction, *_):
        self._dt.drive(str(direction))

    def drive_for(self, direction, distance, units=INCHES, wait=True):
        done = self._dt.drive_for(str(direction), _mm(distance, units))
        return done if wait else None

    def turn(self, direction, *_):
        self._dt.turn(str(direction))

    def turn_for(self, direction, angle, units=DEGREES, wait=True):
        done = self._dt.turn_for(str(direction), angle)
        return done if wait else None

    def turn_to_heading(self, angle, units=DEGREES, wait=True):
        done = self._dt.turn_to_heading(angle)
        return done if wait else None

    def turn_to_rotation(self, angle, units=DEGREES, wait=True):
        done = self._dt.turn_to_rotation(angle)
        return done if wait else None

    def stop(self, *_):
        self._dt.stop()

    def set_heading(self, heading, units=DEGREES):
        self._dt.set_heading(heading)

    def set_rotation(self, rotation, units=DEGREES):
        self._dt.set_rotation(rotation)

    def set_timeout(self, value, units=SECONDS):
        self._dt.set_timeout(_seconds(value, units))

    def set_drive_velocity(self, velocity, units=PERCENT):
        self._dt.set_drive_velocity(velocity)

    def set_turn_velocity(self, velocity, units=PERCENT):
        self._dt.set_turn_velocity(velocity)

    def heading(self, units=DEGREES):
        return self._dt.heading()

    def rotation(self, units=DEGREES):
        return self._dt.rotation()

    def is_done(self):
        return self._dt.is_done()

    def is_moving(self):
        return self._dt.is_moving()


# ---------------------------------------------------------------- sensors


class Location:
    def __init__(self, name="location", *_):
        self._d = vrjs.device(name)

    def position(self, axis, units=MM):
        value = self._d.x() if axis == X else self._d.y()
        return round(_from_mm(value, units), 2)

    def position_angle(self, units=DEGREES):
        return round(self._d.angle(), 2) % 360


# --------------------------------------------------------------- events


class Event:
    def __init__(self):
        self._callbacks = []

    def __call__(self, callback, *args):
        self._callbacks.append((callback, args))

    def broadcast(self):
        for callback, args in self._callbacks:
            _spawn(callback, *args)

    async def broadcast_and_wait(self):
        tasks = [_spawn(callback, *args) for callback, args in self._callbacks]
        if tasks:
            await asyncio.wait(tasks)


# --------------------------------------------------------------- runner

_CLASSES = {"Drivetrain": Drivetrain, "Brain": Brain, "Location": Location}


def _print(*values, sep=" ", end="\n", **_):
    text = sep.join(str(v) for v in values) + end
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line:
            vrjs.console_print(line)
        if i < len(lines) - 1:
            vrjs.console_new_line()


def _make_globals():
    """Globals for student code: everything public here plus robot devices."""
    g = {"__name__": "__main__", "__builtins__": __builtins__}
    module = sys.modules[__name__]
    for name in dir(module):
        if not name.startswith("_") or name.startswith("_vr_"):
            g[name] = getattr(module, name)
    g["print"] = _print
    for device in vrjs.device_list():
        cls = _CLASSES.get(device.kind)
        if cls is not None:
            g[device.name] = cls(device.name)
    g["brain"] = Brain()
    return g


def _reset():
    global _state
    _state = _State()


async def run_program(source):
    """Run a student program to completion (or until stopped)."""
    import transform

    _reset()
    loop = asyncio.get_event_loop()
    _state.stop_future = loop.create_future()
    try:
        code = transform.transform(source)
    except SyntaxError as exc:
        _report_error(exc)
        return

    g = _make_globals()

    async def top_level():
        result = eval(code, g)
        if hasattr(type(result), "__await__"):
            await result

    _spawn(top_level)
    while not _state.stopped:
        if _state.tasks:
            await asyncio.wait(list(_state.tasks))
        elif _state.handlers:
            await _state.stop_future
        else:
            break
    for task in list(_state.tasks):
        task.cancel()
