# Search zones A and B for minerals, bring them back to base, and level up.
# The rover has no location sensor, but it always knows where the base is,
# so it can work out its own position from the base's angle and distance.
import math

# Lookout points to search from (mm), clear of rocks and the river.
LOOKOUTS = [(-4800, -500), (-4800, 1500), (-3000, 1500), (-3000, -500), (-3000, -2300)]


def my_position():
    a = math.radians(rover.angle(BASE))
    d = rover.get_distance(BASE)
    return (rover.location(BASE, X, MM) - d * math.sin(a),
            rover.location(BASE, Y, MM) - d * math.cos(a))


def drive_to_point(x, y):
    mx, my = my_position()
    drivetrain.turn_to_heading(math.degrees(math.atan2(x - mx, y - my)) % 360, DEGREES)
    drivetrain.drive_for(FORWARD, math.hypot(x - mx, y - my), MM)


def collect_here():
    """Look all the way around; grab a mineral if one is in reach."""
    for i in range(12):
        if rover.sees(MINERALS) or rover.detects(MINERALS):
            before = rover.minerals_stored()
            drivetrain.go_to(MINERALS)
            rover.pickup(MINERALS)
            return rover.minerals_stored() > before
        drivetrain.turn_for(RIGHT, 30, DEGREES)
    return False


def fight_back():
    rover.absorb_radiation(ENEMY)


mission_done = False


def leveled_up():
    global mission_done
    brain.print("Level " + str(rover.level()) + "!")
    brain.new_line()
    mission_done = True


def main():
    drivetrain.set_drive_velocity(100, PERCENT)
    drivetrain.set_turn_velocity(100, PERCENT)
    lookout = 0
    while not mission_done:
        if rover.minerals_stored() == rover.storage_capacity():
            drivetrain.go_to(BASE)
            rover.drop(MINERALS)
            if rover.battery() < 60:
                rover.standby(100)
        elif not collect_here():
            drive_to_point(*LOOKOUTS[lookout % len(LOOKOUTS)])
            lookout += 1
    brain.print("Mission complete")
    stop_project()  # event handlers would otherwise keep the program running


rover.on_under_attack(fight_back)
rover.on_level_up(leveled_up)
vr_thread(main)
