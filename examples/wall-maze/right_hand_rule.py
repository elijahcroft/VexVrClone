# Right-hand rule: keep a wall on your right and you will find the exit.
# Works on Wall Maze and on every Dynamic Wall Maze.
def main():
    while not down_eye.detect(GREEN):
        drivetrain.turn_for(RIGHT, 90, DEGREES)
        while front_distance.get_distance(MM) < 150:
            drivetrain.turn_for(LEFT, 90, DEGREES)
        drivetrain.drive_for(FORWARD, 250, MM)
    brain.print("Found the exit!")

vr_thread(main)
