# 🧘 Zen52 - Deep Work Rhythm

[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)

**Zen52** is a premium productivity application designed around the **52/17 rule**: 52 minutes of intense, unbroken focus followed by 17 minutes of complete rest. It combines a minimalist aesthetic with high-performance features to help you enter and maintain a flow state.

---

## ✨ Key Features

### 🕒 High-Performance Timer
- **Rhythmic Focus**: Optimized for the 52/17 cycle, with presets for Pomodoro (25/5), Deep Work (90/15), and more.
- **Zen Mode**: A distraction-free, full-screen interface that keeps you locked into your task.
- **Auto-pilot**: Seamless transitions between focus and break sessions.

### 🎧 Ambient Soundscapes
- **Focus Mixes**: High-quality audio loops (Rain, Forest, Waves) with individual volume controls.
- **Sound Profiles**: Save and load your favorite ambient combinations.

### 📊 Advanced Analytics
- **Focus Heatmap**: Visualize your productivity consistency over time.
- **Trend Analysis**: Track daily, weekly, and monthly focus durations.
- **Session Journaling**: Capture accomplishments and notes at the end of every block.

### 🛡️ Guardrails & Block Sets
- **Lockdown Mode**: Stay away from distracting sites during focus sessions.
- **Custom Block Sets**: Schedule specific times or set daily limits for certain categories of sites.

### ⌨️ Keyboard-First Workflow
- **Command Menu**: Access any feature instantly with `Ctrl + K`.
- **Global Shortcuts**: Play/Pause with `Space`, Reset with `R`, Mute with `M`.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), CSS3 (Modern Grid/Flexbox), HTML5.
- **Backend**: Python (Flask) hosted on Vercel.
- **Database**: Supabase (PostgreSQL) for secure session syncing.
- **Offline First**: Full functionality remains available even without an internet connection.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- A Supabase project (optional for local dev)

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/Refayatul/zen52.git
   cd zen52
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Setup environment variables:
   Create a `.env` file based on `.env.example`:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   python api/index.py
   ```
   Open `http://localhost:5000` in your browser.

---

## 📖 The 52/17 Rule
Research suggests that the most productive people don't work longer hours; they work in smarter rhythms. The **52/17 ratio** is considered the "golden ratio" of productivity. It allows for deep cognitive immersion followed by enough recovery time to prevent burnout and maintain peak performance throughout the day.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Developed with ❤️ for deep thinkers.
