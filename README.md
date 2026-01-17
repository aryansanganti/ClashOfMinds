# Clash of Minds

Turn your study notes into an epic RPG battle. Clash of Minds transforms PDFs, images, or text topics into gamified quizzes where you fight bosses representing the concepts you're learning.

## How It Works

1.  **Content Analysis & Game Design**: The app uses **Gemini 3 Pro** (Reasoning Model) to analyze your uploaded material, extract key concepts, and generate a complete "Master JSON" manifest containing the game script, unique questions, and visual prompts for bosses and environments.
2.  **Parallel Asset Generation**: To ensure speed, we spin up multiple threads targeting **Gemini 2.5 Flash Image** (Nano Banana), generating the player character, background, and unique boss sprites for every turn simultaneously.
3.  **Real-Time Green Screen**: Assets are generated with specific solid backgrounds. The app uses the Canvas API to perform real-time chroma keying (green screen removal) on the client side, compositing characters transparently into the game scene.

## Key Features

*   **Player Customization**: Tailor your hero with specific age, gender (Male, Female, Non-binary), and ethnicity settings.
*   **Smart Review System**: The game tracks every question you miss. Review your mistakes later to reinforce learning.
*   **Persistent Statistics**: Track your win rates, longest streaks, and total study time across different topics.
*   **Educational Focus**: Questions are strictly derived from your source material to ensure genuine studying value.
