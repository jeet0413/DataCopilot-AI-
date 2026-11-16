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

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd datacopilot-ai
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

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

## Mock Data

The application currently uses mock data to demonstrate functionality. The API service (`src/services/api.js`) simulates backend responses with realistic delays and data structures.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit and push your changes
5. Open a pull request

## License

This project is licensed under the MIT License.
