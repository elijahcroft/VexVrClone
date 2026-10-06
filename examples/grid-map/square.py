# Drive a square: 4 sides of 400 mm, turning right at each corner.
def main():
    for side in range(4):
        drivetrain.drive_for(FORWARD, 400, MM)
        drivetrain.turn_for(RIGHT, 90, DEGREES)
    brain.print("Back home at", location.position(X, MM), location.position(Y, MM))

vr_thread(main)
