#!/usr/bin/env python3
"""Simple integer addition program."""

import sys


def main():
    if len(sys.argv) != 3:
        print(f"Usage: python add.py <num1> <num2>", file=sys.stderr)
        sys.exit(1)

    try:
        a = int(sys.argv[1])
        b = int(sys.argv[2])
        result = a + b
        print(f"{a} + {b} = {result}")
    except ValueError:
        print("Error: Both arguments must be integers", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
