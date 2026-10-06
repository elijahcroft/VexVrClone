# Each column is one letter: 8 squares, blue = 1, white = 0, highest bit first.
def read_letter():
    bits = []
    for i in range(8):
        drivetrain.drive_for(FORWARD, 200, MM)
        bits.append(1 if down_eye.detect(BLUE) else 0)
    value = 0
    for bit in bits:
        value = value * 2 + bit
    return chr(value)

def main():
    drivetrain.set_drive_velocity(100, PERCENT)
    message = ""
    for column in range(5):
        # Start each column with the down eye just below the first square.
        drivetrain.turn_to_heading(0, DEGREES)
        message += read_letter()
        drivetrain.drive_for(REVERSE, 1600, MM)
        drivetrain.turn_to_heading(90, DEGREES)
        drivetrain.drive_for(FORWARD, 300, MM)
    print(message)

vr_thread(main)
