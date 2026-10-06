# Drive up the lane in small steps and list each line's color.
def color_under():
    for color in (RED, GREEN, BLUE):
        if down_eye.detect(color):
            return str(color)
    return None

def main():
    found = []
    on_line = False
    while location.position(Y, MM) < 850:
        drivetrain.drive_for(FORWARD, 10, MM)
        color = color_under()
        if color and not on_line:
            found.append(color)
        on_line = color is not None
    print(found)

vr_thread(main)
