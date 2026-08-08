import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

CSV_URL = "https://raw.githubusercontent.com/Asadabz/traffic-data-collector/refs/heads/main/realtime_traffic_data.csv?token=GHSAT0AAAAAAEBISAAHR7ZT6MVLSXKG326U2TWW6TA"

print("Loading data...")
df = pd.read_csv(CSV_URL)

# Clean
df = df.dropna()
df["timestamp"] = pd.to_datetime(df["timestamp"])

# Feature engineering
df["hour"] = df["timestamp"].dt.hour
df["day_of_week"] = df["timestamp"].dt.dayofweek

road_encoder = LabelEncoder()
city_encoder = LabelEncoder()
df["road_encoded"] = road_encoder.fit_transform(df["road"])
df["city_encoded"] = city_encoder.fit_transform(df["city"])

# IMPORTANT: current_speed and free_flow_speed removed from features.
# Reason: congestion_ratio is directly derived from these two columns,
# so including them lets the model "cheat" (just does the math) instead
# of learning real time/road-based traffic patterns. Also, at prediction
# time (future date/time), we won't have current_speed available anyway.
features = ["hour", "day_of_week", "road_encoded", "city_encoded"]
target = "congestion_ratio"

X = df[features]
y = df[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training model...")
model = RandomForestRegressor(n_estimators=200, max_depth=12, random_state=42)
model.fit(X_train, y_train)

preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
r2 = r2_score(y_test, preds)

print(f"MAE: {mae:.4f}")
print(f"R2 Score: {r2:.4f}")
print(f"Trained on {len(df)} rows")
print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")

joblib.dump(model, "model.pkl")
joblib.dump(road_encoder, "road_encoder.pkl")
joblib.dump(city_encoder, "city_encoder.pkl")

print("Saved: model.pkl, road_encoder.pkl, city_encoder.pkl")