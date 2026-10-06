# Drive straight up the middle, stopping before the edge with the down eye.
def main():
    drivetrain.set_drive_velocity(80, PERCENT)
    while down_eye.near_object():
        drivetrain.drive_for(FORWARD, 20, MM)
    drivetrain.drive_for(REVERSE, 300, MM)
    brain.print("Stopped at the edge")

vr_thread(main)
