# Sort every disk into its matching zone using the Location sensor.
import math

ZONE_X = {"RED": -600, "GREEN": 0, "BLUE": 600}
dropped = {"RED": 0, "GREEN": 0, "BLUE": 0}

# (x, y, color) of each disk, top row first so paths stay clear.
DISKS = [
    (-500, 100, "GREEN"), (0, 100, "BLUE"), (500, 100, "RED"),
    (-500, -200, "BLUE"), (0, -200, "RED"), (500, -200, "GREEN"),
    (-250, -500, "RED"), (250, -500, "GREEN"), (600, -650, "BLUE"),
]

def go_to(x, y):
    dx = x - location.position(X, MM)
    dy = y - location.position(Y, MM)
    drivetrain.turn_to_heading(math.degrees(math.atan2(dx, dy)) % 360, DEGREES)
    drivetrain.drive_for(FORWARD, math.hypot(dx, dy), MM)

def main():
    drivetrain.set_drive_velocity(100, PERCENT)
    drivetrain.set_turn_velocity(100, PERCENT)
    go_to(-800, 270)
    for x, y, color in DISKS:
        go_to(x, y + 170)                  # stop just north of the disk
        drivetrain.turn_to_heading(180, DEGREES)
        magnet.energize(BOOST)
        offset = (dropped[color] - 1) * 130
        dropped[color] += 1
        go_to(ZONE_X[color] + offset, 610)  # in front of the zone
        drivetrain.turn_to_heading(0, DEGREES)
        magnet.energize(DROP)
    brain.print("All sorted")

vr_thread(main)
