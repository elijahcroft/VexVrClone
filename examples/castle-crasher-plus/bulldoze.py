# Push straight across the island, stopping before the water.
def main():
    drivetrain.set_drive_velocity(80, PERCENT)
    while down_eye.near_object():
        drivetrain.drive_for(FORWARD, 20, MM)
    drivetrain.drive_for(REVERSE, 400, MM)
    brain.print("Safe on shore")

vr_thread(main)
