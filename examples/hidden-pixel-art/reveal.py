# Read every pixel's hidden color into a 2D list, then fill them in.
RGB = {"RED": (220, 38, 38), "GREEN": (22, 163, 74), "BLUE": (37, 99, 235), "NONE": (255, 255, 255)}

def color_under():
    for color in (RED, GREEN, BLUE):
        if down_eye.detect(color):
            return str(color)
    return "NONE"

def main():
    drivetrain.set_drive_velocity(100, PERCENT)
    art = []
    for column in range(8):
        x = -700 + column * 200
        drivetrain.turn_to_heading(0, DEGREES)
        pixels = []
        for row in range(8):
            # Put the robot's center (where the pen is) on the pixel.
            drivetrain.drive_for(FORWARD, 200 if row else 217, MM)
            color = color_under()
            pixels.append(color)
            pen.fill(*RGB[color], 100)
        art.append(pixels)
        drivetrain.drive_for(REVERSE, 1617, MM)
        if column < 7:
            drivetrain.turn_to_heading(90, DEGREES)
            drivetrain.drive_for(FORWARD, 200, MM)
    print(sum(row.count("RED") for row in art), "red pixels")

vr_thread(main)
