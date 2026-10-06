# A five-pointed star: turn 144 degrees at each point.
def main():
    pen.set_pen_color(RED)
    pen.set_pen_width(WIDE)
    drivetrain.drive_for(REVERSE, 300, MM)
    pen.move(DOWN)
    for point in range(5):
        drivetrain.drive_for(FORWARD, 700, MM)
        drivetrain.turn_for(RIGHT, 144, DEGREES)
    pen.move(UP)

vr_thread(main)
