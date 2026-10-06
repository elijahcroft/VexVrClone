# Drive to square 45: 4 squares right, 4 squares up from square 1.
def main():
    drivetrain.turn_for(RIGHT, 90, DEGREES)
    drivetrain.drive_for(FORWARD, 4 * 200, MM)
    drivetrain.turn_for(LEFT, 90, DEGREES)
    drivetrain.drive_for(FORWARD, 4 * 200, MM)
    x = location.position(X, MM)
    y = location.position(Y, MM)
    square = int((y + 1000) // 200) * 10 + int((x + 1000) // 200) + 1
    print("I am on square", square)

vr_thread(main)
