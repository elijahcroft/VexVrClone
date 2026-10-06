# Carry each piece of trash to the recycling zone with the magnet.
# Every trip starts and ends on a "dock" line just above the zone.
import math

TRASH = [(-700, -400), (700, -400), (-500, 200), (500, 200),
         (-150, 500), (250, 600), (-750, 750), (750, 750)]

def go_to(x, y, stop_short=0):
    dx = x - location.position(X, MM)
    dy = y - location.position(Y, MM)
    drivetrain.turn_to_heading(math.degrees(math.atan2(dx, dy)) % 360, DEGREES)
    drivetrain.drive_for(FORWARD, math.hypot(dx, dy) - stop_short, MM)

def main():
    drivetrain.set_drive_velocity(100, PERCENT)
    drivetrain.set_turn_velocity(100, PERCENT)
    for i, (x, y) in enumerate(TRASH):
        dock = -280 + i * 80
        go_to(dock, -560)
        go_to(x, y, stop_short=160)   # magnet reaches 150 mm ahead
        magnet.energize(BOOST)
        go_to(dock, -560)
        drivetrain.turn_to_heading(180, DEGREES)
        magnet.energize(DROP)
    brain.print("Reef is clean!")

vr_thread(main)
