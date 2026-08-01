#!/usr/bin/env python3
"""
reset_pin.py — Staff PIN Reset Utility
=======================================
Resets the 4-digit PIN for a staff or kitchen user identified by their staff_code.

Usage:
    python reset_pin.py --staff-code 2522 --new-pin 1234

Requirements:
    - Must be run from the backend/ directory (or the project root).
    - Requires the same .env / database config as the Flask app.
"""

import argparse
import sys
import os

def main():
    parser = argparse.ArgumentParser(description="Reset a staff member's 4-digit login PIN.")
    parser.add_argument("--staff-code", required=True, help="The 4-digit staff login code (e.g. 2522)")
    parser.add_argument("--new-pin",    required=True, help="New 4-digit PIN to set (e.g. 1234)")
    args = parser.parse_args()

    staff_code = args.staff_code.strip()
    new_pin    = args.new_pin.strip()

    # Validate inputs
    if not staff_code.isdigit() or len(staff_code) != 4:
        print(f"[ERROR] Staff code must be exactly 4 digits. Got: '{staff_code}'")
        sys.exit(1)
    if not new_pin.isdigit() or len(new_pin) != 4:
        print(f"[ERROR] New PIN must be exactly 4 digits. Got: '{new_pin}'")
        sys.exit(1)

    # Import app modules — adjust path if needed
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, backend_dir)

    try:
        from app import create_app, db, bcrypt
        from models import User
        app = create_app()
    except ImportError as e:
        print(f"[ERROR] Could not import Flask app: {e}")
        print("  Make sure you are running this from the backend/ directory.")
        sys.exit(1)

    with app.app_context():
        # Find user by staff_code
        user = User.query.filter_by(staff_code=staff_code).first()
        if not user:
            print(f"[ERROR] No user found with staff_code={staff_code}")
            sys.exit(1)

        if user.role not in ("staff", "kitchen"):
            print(f"[WARNING] User {user.email!r} has role={user.role!r} (expected 'staff' or 'kitchen').")
            confirm = input("Do you still want to reset their PIN? [y/N] ").strip().lower()
            if confirm != "y":
                print("Aborted.")
                sys.exit(0)

        # Hash the new PIN using bcrypt
        hashed_pin = bcrypt.generate_password_hash(new_pin).decode("utf-8")
        user.pin_hash = hashed_pin

        db.session.commit()

        print(f"[OK] PIN reset successfully for:")
        print(f"     Name      : {user.first_name or ''} {user.last_name or ''}".strip())
        print(f"     Email     : {user.email}")
        print(f"     Role      : {user.role}")
        print(f"     Staff Code: {staff_code}")
        print(f"     New PIN   : {'*' * len(new_pin)} (hashed and saved)")
        print()
        print("The staff member can now log in with:")
        print(f"  Staff Code: {staff_code}")
        print(f"  PIN       : {new_pin}")


if __name__ == "__main__":
    main()
