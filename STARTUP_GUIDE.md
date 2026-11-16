# 🚀 **AI DATA ANALYST COPILOT - COMPLETE STARTUP GUIDE**

---

## 🎯 **QUICK START - 3 SIMPLE STEPS**

---

## 📋 **PREREQUISITES**

### **✅ Required Software:**
- **Node.js 16+** (for frontend and backend)
- **Python 3.8+** (for AI service)
- **Git** (for version control)

### **✅ Required Accounts:**
- **Supabase Account** (for database)
- **OpenAI API Key** (optional, for advanced AI features)
- **HuggingFace API Key** (optional, for alternative AI models)

---

## 🔧 **STEP 1: INSTALL DEPENDENCIES**

### **✅ Frontend Dependencies:**
```bash
# Navigate to project root
cd "d:/__PROJECTS/Datacopilot ai windsurf 1/Datacopilot ai windsurf"

# Install frontend packages
npm install
```

### **✅ Backend Dependencies:**
```bash
# Navigate to backend directory
cd backend

# Install backend packages
npm install

# Return to project root
cd ..
```

### **✅ Python AI Service:**
```bash
# Navigate to AI service directory
cd ai-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install Python packages
pip install -r requirements.txt

# Return to project root
cd ..
```

---

## ⚙️ **STEP 2: CONFIGURE ENVIRONMENT**

### **✅ Get Supabase Credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Copy the **Connection string**
5. Go to **Settings** → **API**
6. Copy the **anon key** and **service_role key**

### **✅ Configure Backend (.env):**
```bash
# Edit backend/.env file
```

**Replace with your actual credentials:**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Configuration
JWT_SECRET=datacopilot-ai-super-secret-jwt-key-2024-change-in-production

# Server Configuration
PORT=3002
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# AI Service Configuration
AI_SERVICE_URL=http://localhost:8001
```

### **✅ Configure AI Service (.env):**
```bash
# Edit ai-service/.env file
```

**Replace with your actual credentials:**
```bash
# AI Service Configuration
OPENAI_API_KEY=your_openai_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Database Connection (get from Supabase)
SUPABASE_URL=postgresql://postgres.your-project:your_password@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# Service Configuration
AI_SERVICE_PORT=8001
NODEJS_BACKEND_URL=http://localhost:3002
```

**📝 How to get database password:**
1. In Supabase Dashboard → **Settings** → **Database**
2. Scroll to **Connection string**
3. Copy the full PostgreSQL connection string
4. Replace `password` with your actual database password

---

## 🚀 **STEP 3: START ALL SERVICES**

### **✅ Open 3 Terminal Windows:**

### **🔥 Terminal 1: Start AI Service**
```bash
# Navigate to AI service
cd ai-service

# Activate virtual environment (Windows)
venv\Scripts\activate
# (Linux/Mac: source venv/bin/activate)

# Start AI service
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process [12345]
INFO:     Started server process [12346]
```

### **🔥 Terminal 2: Start Backend**
```bash
# Navigate to backend
cd backend

# Start Node.js backend
npm start
```

**Expected Output:**
```
🚀 Server running on port 3002
📁 Uploads directory: D:\...\backend\uploads
🌐 Frontend URL: http://localhost:3000
✅ Supabase client initialized
```

### **🔥 Terminal 3: Start Frontend**
```bash
# Navigate to project root
cd "d:/__PROJECTS/Datacopilot ai windsurf 1/Datacopilot ai windsurf"

# Start React frontend
npm start
```

**Expected Output:**
```
Compiled successfully!
You can now view datacopilot-ai in the browser.
  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.100:3000
```

---

## 🎯 **ACCESS THE APPLICATION**

### **✅ Open Your Browser:**
Navigate to: **http://localhost:3000**

### **✅ First Time Setup:**
1. **Sign Up** for a new account
2. **Login** with your credentials
3. **Upload a CSV file** to test the AI features
4. **Try the AI Query** feature with natural language
5. **Check the Insights** page for AI-generated analysis

---

## 🔍 **TROUBLESHOOTING**

### **❌ Common Issues & Solutions:**

#### **Port Already in Use:**
```bash
# Check what's using the port
netstat -ano | findstr :3000
netstat -ano | findstr :3002
netstat -ano | findstr :8001

# Kill the process (replace PID)
taskkill /PID 12345 /F
```

#### **Python Not Found:**
```bash
# Install Python from python.org
# Add Python to PATH during installation
```

#### **Virtual Environment Issues:**
```bash
# Delete and recreate venv
rmdir /s venv
python -m venv venv
venv\Scripts\activate
```

#### **Database Connection Error:**
```bash
# Verify Supabase credentials
# Check if database is active in Supabase dashboard
# Ensure correct connection string format
```

#### **CORS Errors:**
```bash
# Verify FRONTEND_URL in backend/.env
# Ensure all services are running
```

---

## 🎮 **TESTING THE AI FEATURES**

### **✅ Test CSV Upload:**
1. Create a sample CSV file with columns like `name, age, salary`
2. Upload it through the Upload page
3. Check if it appears in the Dataset list

### **✅ Test AI Query:**
1. Go to the Query page
2. Select your uploaded dataset
3. Try questions like:
   - "How many records are there?"
   - "What's the average salary?"
   - "Show me the highest paid person"

### **✅ Test AI Insights:**
1. Go to the Insights page
2. Select your dataset
3. Click "Refresh" to generate AI insights
4. Check the generated recommendations

---

## 🎉 **SUCCESS INDICATORS**

### **✅ All Services Running:**
- ✅ **AI Service**: Running on http://localhost:8001
- ✅ **Backend**: Running on http://localhost:3002
- ✅ **Frontend**: Running on http://localhost:3000

### **✅ Health Checks Working:**
```bash
# Test AI service
curl http://localhost:8001/

# Test backend
curl http://localhost:3002/api/health

# Test frontend
# Open http://localhost:3000 in browser
```

### **✅ AI Features Working:**
- ✅ CSV files can be uploaded and analyzed
- ✅ Natural language queries generate SQL
- ✅ AI insights are generated
- ✅ Recommendations are provided

---

## 🚀 **NEXT STEPS**

### **✅ After Successful Startup:**
1. **Upload your own datasets** for analysis
2. **Try complex queries** to test AI capabilities
3. **Explore the Settings** page for customization
4. **Check the Dashboard** for overview statistics

### **✅ Production Deployment:**
1. **Configure production environment variables**
2. **Set up proper SSL certificates**
3. **Deploy to cloud services (AWS, Vercel, etc.)**
4. **Set up monitoring and logging**

---

## 🎯 **QUICK REFERENCE**

### **✅ Startup Commands Summary:**
```bash
# Terminal 1 - AI Service
cd ai-service && venv\Scripts\activate && uvicorn app:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Backend
cd backend && npm start

# Terminal 3 - Frontend
npm start
```

### **✅ URLs:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002/api
- **AI Service**: http://localhost:8001

### **✅ Important Files:**
- **Frontend**: `src/App.jsx`, `src/pages/`
- **Backend**: `backend/server.js`, `backend/ai-routes.js`
- **AI Service**: `ai-service/app.py`
- **Environment**: `backend/.env`, `ai-service/.env`

---

## 🎊 **CONCLUSION**

## ✅ **YOUR AI DATA ANALYST IS READY!**

**🚀 You now have a fully functional AI Data Analyst Copilot with:**
- **Natural Language Query Processing**
- **Automated Data Insights**
- **Business Recommendations**
- **Professional UI/UX**
- **Production-Ready Architecture**

**🎯 Start exploring your data with AI-powered analysis!**

---

*Startup guide created successfully on March 29, 2026*
