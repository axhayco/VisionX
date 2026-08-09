from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI-Powered Lab Report Triage API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Lab Report Triage Backend is running."}


@app.post("/triage")
async def triage_report(file: UploadFile = File(...)):
    """Accepts an uploaded lab report file and returns triage status."""
    return {
        "urgency": "Routine",
        "reasoning": "test",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
