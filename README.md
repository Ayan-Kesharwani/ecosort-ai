# EcoSort AI (TrashScan Analyzer)

EcoSort AI is an intelligent waste classification web application designed to help users identify, categorize, and properly segregate household and municipal waste using multi-tiered computer vision models.

## Key Features
- **Real-Time Image Classification:** Upload images or use camera capture to instantly detect waste types (recyclables, compost, hazardous, land-fill).
- **Proper Handling Instructions:** Provides localized disposal guidance, safety precautions, and recycling recommendations based on the identified material.
- **High-Availability Architecture:** Built with an automated fallback pipeline to ensure constant uptime and low-latency analysis.

## Technical Architecture & Vision Pipeline

The application processes image inputs through a multi-model fallback pipeline via OpenRouter to maximize accuracy while maintaining system reliability:

- **Primary Vision Model:** Gemini 3.7 Flash (optimized for rapid, high-accuracy image classification)
- **Secondary Fallback:** GPT-5.6 Luna (automatically triggered if primary endpoints experience latency or failure)
- **Tertiary Fallback:** Nemotron (zero-cost open-weights fallback to guarantee service availability)

## Tech Stack
- **Frontend / UI:** React, TypeScript, Tailwind CSS
- **Backend / Services:** Node.js, Express
- **AI Integration:** OpenRouter Unified API Interface
