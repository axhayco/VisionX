import os
import subprocess
import sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
VENV_DIR = os.path.join(ROOT_DIR, ".venv")

# Determine python and pip executables inside the virtual environment
if sys.platform == "win32":
    PYTHON_EXE = os.path.join(VENV_DIR, "Scripts", "python.exe")
    PIP_EXE = os.path.join(VENV_DIR, "Scripts", "pip.exe")
    UVICORN_EXE = os.path.join(VENV_DIR, "Scripts", "uvicorn.exe")
else:
    PYTHON_EXE = os.path.join(VENV_DIR, "bin", "python")
    PIP_EXE = os.path.join(VENV_DIR, "bin", "pip")
    UVICORN_EXE = os.path.join(VENV_DIR, "bin", "uvicorn")

def run_command(command, cwd=None, shell=True):
    print(f"Running: {command} in {cwd or ROOT_DIR}")
    result = subprocess.run(command, cwd=cwd, shell=shell)
    if result.returncode != 0:
        print(f"Error executing command: {command}")
        sys.exit(result.returncode)

def main():
    # 1. Setup Venv if missing
    if not os.path.exists(VENV_DIR):
        print("Virtual environment not found. Creating one...")
        run_command(f'"{sys.executable}" -m venv .venv')

    # 2. Install backend dependencies
    print("Installing/verifying backend dependencies...")
    run_command(f'"{PIP_EXE}" install -r backend/requirements.txt')

    # 3. Compile frontend if built files are missing
    static_index = os.path.join(BACKEND_DIR, "app", "static", "index.html")
    if not os.path.exists(static_index):
        print("Frontend static files not found. Preparing build...")
        
        # Check node_modules
        node_modules = os.path.join(FRONTEND_DIR, "node_modules")
        if not os.path.exists(node_modules):
            print("Installing frontend dependencies...")
            run_command("npm install", cwd=FRONTEND_DIR)
            
        print("Building frontend assets...")
        run_command("npm run build", cwd=FRONTEND_DIR)

    # 4. Seed database if it does not exist
    db_file = os.path.join(ROOT_DIR, "lab_reports.db")
    if not os.path.exists(db_file):
        print("Database not found. Running seed script...")
        run_command(f'"{PYTHON_EXE}" backend/seed.py')

    # 5. Launch FastAPI server
    print("\n" + "="*50)
    print("AI Lab Report Triage is starting up!")
    print("Open your browser and navigate to: http://127.0.0.1:8000")
    print("="*50 + "\n")
    
    # Run uvicorn from backend dir so imports like 'app.main' resolve properly
    run_command(f'"{UVICORN_EXE}" app.main:app --host 127.0.0.1 --port 8000', cwd=BACKEND_DIR)

if __name__ == "__main__":
    main()
