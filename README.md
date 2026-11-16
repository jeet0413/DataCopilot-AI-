# DataCopilot AI

A modern SaaS web application for AI-powered data analysis and insights.

## Features

- **Dashboard**: Overview of datasets, KPIs, and recent insights
- **Upload**: Drag-and-drop CSV file upload with preview
- **Query**: Chat interface for asking questions about your data
- **Insights**: Auto-generated KPIs, charts, and business insights
- **Dark/Light Mode**: Toggle between themes
- **Responsive Design**: Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend**: React 18
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router

## Architecture

```
Browser (React, :3000) -> Express backend (:3002) -> FastAPI AI service (:8001) -> PostgreSQL
                              |                                                   (schema user_data)
                              +-> Supabase (users + dataset metadata)
```

- The browser only talks to the backend and sends a `dataset_id`; the backend checks ownership.
- The AI service accepts calls only with the shared `X-Internal-Token` secret.
- Each uploaded CSV becomes its own table `user_data.ds_<uuid>`. Generated SQL is validated
  (single SELECT, own table only), then run in a read-only transaction with a timeout and row cap.

## Getting Started

Prerequisites: Node 18+, Python 3.12, a PostgreSQL database, optionally a Supabase project.

1. Run `backend/migrations/001_passwords_and_dataset_tables.sql` in Supabase (after `backend/complete-schema.sql`).
2. AI service:
```bash
cd ai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # set DATABASE_URL, AI_SERVICE_TOKEN, optional HUGGINGFACE_API_KEY
uvicorn app:app --port 8001
```
3. Backend:
```bash
cd backend
npm install
cp .env.example .env      # set JWT_SECRET, AI_SERVICE_TOKEN (same value), SUPABASE_*
npm start                 # http://localhost:3002
```
Without Supabase configured the backend uses an in-memory user store (development only).
4. Frontend: `npm install && npm start` (http://localhost:3000). Set `REACT_APP_API_URL` if the backend is elsewhere.

## Tests

```bash
cd ai-service && pip install -r requirements-dev.txt && TEST_DATABASE_URL=postgresql://... pytest
cd backend && TEST_PYTHON=/path/to/python TEST_DATABASE_URL=postgresql://... npm test
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Sidebar.jsx
│   ├── DatasetCard.jsx
│   ├── ChatBox.jsx
│   └── ChartCard.jsx
├── pages/              # Page components
│   ├── Dashboard.jsx
│   ├── Upload.jsx
│   ├── Query.jsx
│   ├── Insights.jsx
│   └── Settings.jsx
├── services/           # API services
│   └── api.js
├── utils/              # Utility functions
│   └── helpers.js
├── App.jsx             # Main App component
├── index.js            # Entry point
└── index.css           # Global styles
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (one-way operation)

## Design System

The application uses a clean, minimal design inspired by modern SaaS products like Stripe and Notion:

- **Colors**: Primary blue palette with semantic colors
- **Typography**: System fonts with clear hierarchy
- **Spacing**: Consistent 8px grid system
- **Components**: Rounded corners, subtle shadows, smooth animations
- **Dark Mode**: Full dark theme support

See `DEVELOPMENT_TRACKER.md` for current status, known gaps and the roadmap.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit and push your changes
5. Open a pull request

## License

This project is licensed under the MIT License.
