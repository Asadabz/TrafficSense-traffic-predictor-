from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI()

model = joblib.load("model.pkl")
road_encoder = joblib.load("road_encoder.pkl")
city_encoder = joblib.load("city_encoder.pkl")


class PredictRequest(BaseModel):
    city: str
    road: str
    hour: int
    day_of_week: int


@app.post("/predict")
def predict(req: PredictRequest):
    city_encoded = city_encoder.transform([req.city])[0]
    road_encoded = road_encoder.transform([req.road])[0]

    features = pd.DataFrame([{
        "hour": req.hour,
        "day_of_week": req.day_of_week,
        "road_encoded": road_encoded,
        "city_encoded": city_encoded,
    }])

    prediction = model.predict(features)[0]

    if prediction < 0.3:
        zone = "light"
    elif prediction < 0.6:
        zone = "moderate"
    else:
        zone = "heavy"

    return {
        "congestion_ratio": round(float(prediction), 4),
        "zone": zone
    }


@app.get("/health")
def health():
    return {"status": "ok"}