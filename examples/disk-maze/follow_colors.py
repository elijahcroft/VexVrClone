# Drive until the down eye sees a marker: red = turn right, blue = turn left,
# green = goal. The eye is ahead of the robot's center, so after seeing a
# marker's edge, drive 140 mm more to put the center on the marker.
def main():
    while True:
        drivetrain.drive_for(FORWARD, 10, MM)
        if down_eye.detect(GREEN):
            break
        if down_eye.detect(RED) or down_eye.detect(BLUE):
            right = down_eye.detect(RED)
            drivetrain.drive_for(FORWARD, 140, MM)
            drivetrain.turn_for(RIGHT if right else LEFT, 90, DEGREES)
            drivetrain.drive_for(FORWARD, 100, MM)  # get off the marker
    drivetrain.drive_for(FORWARD, 140, MM)
    brain.print("Goal!")

vr_thread(main)
