"""Rewrite student code so blocking robot commands don't freeze the browser.

Pyodide runs on the browser's main thread, so a call like
drivetrain.drive_for(FORWARD, 200, MM) can't block for real. Instead we turn
the program into asyncio code:

  * every user `def` becomes `async def` (except dunders and generators)
  * every call `f(a, b)` becomes `await _vr_call(f, a, b)`, which awaits the
    result only if it is awaitable (robot commands return JS Promises)
  * every loop body starts with `await _vr_tick()`, which yields to the
    browser now and then and raises ProgramStopped when Stop is pressed

Line numbers are preserved so errors point at the student's own code.
"""

import ast

# Calls that rely on the caller's frame and must not be wrapped.
_UNWRAPPED = {"super", "locals", "globals", "vars", "eval", "exec", "dir"}


def _is_generator(fn):
    """True if `fn` itself (not a nested function) contains yield."""
    stack = list(fn.body)
    while stack:
        node = stack.pop()
        if isinstance(node, (ast.Yield, ast.YieldFrom)):
            return True
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
            continue
        stack.extend(ast.iter_child_nodes(node))
    return False


def _tick():
    return ast.Expr(ast.Await(ast.Call(ast.Name("_vr_tick", ast.Load()), [], [])))


class _Transformer(ast.NodeTransformer):
    def __init__(self):
        # Whether `await` is legal at the current point. Module level is
        # allowed because we compile with PyCF_ALLOW_TOP_LEVEL_AWAIT.
        self.can_await = [True]

    def _visit_in(self, node, can_await):
        self.can_await.append(can_await)
        try:
            return self.generic_visit(node)
        finally:
            self.can_await.pop()

    def visit_FunctionDef(self, node):
        name = node.name
        if (name.startswith("__") and name.endswith("__")) or _is_generator(node):
            # Decorators and defaults are evaluated in the enclosing scope.
            node.decorator_list = [self.visit(d) for d in node.decorator_list]
            node.args = self.visit(node.args)
            self.can_await.append(False)
            try:
                node.body = [self.visit(s) for s in node.body]
            finally:
                self.can_await.pop()
            return node
        new = ast.AsyncFunctionDef(
            name=node.name,
            args=node.args,
            body=node.body,
            decorator_list=node.decorator_list,
            returns=node.returns,
            type_comment=node.type_comment,
            type_params=getattr(node, "type_params", []),
        )
        ast.copy_location(new, node)
        new.decorator_list = [self.visit(d) for d in new.decorator_list]
        new.args = self.visit(new.args)
        self.can_await.append(True)
        try:
            new.body = [self.visit(s) for s in new.body]
        finally:
            self.can_await.pop()
        return new

    def visit_AsyncFunctionDef(self, node):
        return self._visit_in(node, True)

    def visit_ClassDef(self, node):
        # Class bodies run synchronously; methods inside get their own context.
        return self._visit_in(node, False)

    def visit_Lambda(self, node):
        return self._visit_in(node, False)

    def visit_GeneratorExp(self, node):
        # An await here would turn it into an async generator, which breaks
        # sum(), any(), etc.
        return self._visit_in(node, False)

    def _loop(self, node):
        self.generic_visit(node)
        if self.can_await[-1]:
            node.body.insert(0, ast.copy_location(_tick(), node.body[0]))
        return node

    visit_While = _loop
    visit_For = _loop

    def visit_Call(self, node):
        self.generic_visit(node)
        if not self.can_await[-1]:
            return node
        if isinstance(node.func, ast.Name) and node.func.id in _UNWRAPPED:
            return node
        wrapped = ast.Await(
            ast.Call(
                ast.Name("_vr_call", ast.Load()),
                [node.func, *node.args],
                node.keywords,
            )
        )
        return ast.copy_location(wrapped, node)


def transform(source, filename="main.py"):
    """Return a code object for `source` rewritten to async form."""
    tree = ast.parse(source, filename)
    tree = _Transformer().visit(tree)
    ast.fix_missing_locations(tree)
    return compile(tree, filename, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
