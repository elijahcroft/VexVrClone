# Trace the square (choose the "Square" starting position).
def main():
    pen.set_pen_color(BLUE)
    pen.set_pen_width(MEDIUM)
    pen.move(DOWN)
    for side in range(4):
        drivetrain.drive_for(FORWARD, 450, MM)
        drivetrain.turn_for(RIGHT, 90, DEGREES)
    pen.move(UP)

vr_thread(main)
