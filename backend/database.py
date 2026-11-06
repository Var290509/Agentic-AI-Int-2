import sqlite3
import os
import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "smart_city.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. HITL Traffic Fines Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        violation TEXT NOT NULL,
        vehicle_plate TEXT NOT NULL,
        fine_amount REAL NOT NULL,
        evidence_image TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        detected_at TIMESTAMP NOT NULL,
        reviewed_at TIMESTAMP,
        reviewer_id TEXT,
        receipt_id TEXT
    );
    """)

    # 2. Control Forces Accident Dispatch Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS accidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        maps_url TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        detected_at TIMESTAMP NOT NULL,
        dispatch_channel TEXT NOT NULL,
        dispatch_status TEXT NOT NULL
    );
    """)

    # 3. City Residents Table (for Geo-Targeted Flood Alerts)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS residents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        sector TEXT NOT NULL
    );
    """)

    # 4. Flood Broadcast History Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS flood_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sector TEXT NOT NULL,
        water_level_meters REAL NOT NULL,
        alert_message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        recipients_count INTEGER NOT NULL,
        status TEXT NOT NULL
    );
    """)

    # Seed mock residents across Sector A, Sector B, Sector C if empty
    cursor.execute("SELECT COUNT(*) FROM residents;")
    if cursor.fetchone()[0] == 0:
        seed_residents = [
            ("Alice Smith", "+1-555-0101", "alice@example.com", "Sector A"),
            ("Bob Jones", "+1-555-0102", "bob@example.com", "Sector A"),
            ("Rajesh Kumar", "+1-555-0103", "rajesh@example.com", "Sector B"),
            ("Priya Sharma", "+1-555-0104", "priya@example.com", "Sector B"),
            ("Carlos Gomez", "+1-555-0105", "carlos@example.com", "Sector B"),
            ("David Lee", "+1-555-0106", "david@example.com", "Sector C"),
            ("Elena Rostova", "+1-555-0107", "elena@example.com", "Sector C"),
            ("Fatima Al-Sayed", "+1-555-0108", "fatima@example.com", "Sector B"),
        ]
        cursor.executemany("INSERT INTO residents (name, phone, email, sector) VALUES (?, ?, ?, ?)", seed_residents)

    # Seed initial sample violation in fines table if empty
    cursor.execute("SELECT COUNT(*) FROM fines;")
    if cursor.fetchone()[0] == 0:
        now_str = datetime.datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO fines (violation, vehicle_plate, fine_amount, evidence_image, status, detected_at)
            VALUES (?, ?, ?, ?, 'PENDING', ?)
        """, ("Red Light Jump", "AP-39-BK-4021", 1000.0, "violation_12.jpg", now_str))
        cursor.execute("""
            INSERT INTO fines (violation, vehicle_plate, fine_amount, evidence_image, status, detected_at)
            VALUES (?, ?, ?, ?, 'PENDING', ?)
        """, ("Helmetless Riding", "MH-12-DE-1492", 500.0, "violation_08.jpg", now_str))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Smart City Database Initialized successfully.")
