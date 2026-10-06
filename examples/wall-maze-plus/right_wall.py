# MazeBot right-hand rule: if the right side is open, turn right; otherwise
# turn left until the way ahead is open. Then move one square.
def main():
    drivetrain.set_drive_velocity(100, PERCENT)
    drivetrain.set_turn_velocity(100, PERCENT)
    while not down_eye.detect(GREEN):
        if right_distance.get_distance(MM) > 150:
            drivetrain.turn_for(RIGHT, 90, DEGREES)
        else:
            while front_distance.get_distance(MM) < 150:
                drivetrain.turn_for(LEFT, 90, DEGREES)
        drivetrain.drive_for(FORWARD, 250, MM)
    brain.print("Escaped the big maze!")

vr_thread(main)
