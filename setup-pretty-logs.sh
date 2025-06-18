#!/bin/bash

echo "🔧 Setting up prettier logs for Vale Backend..."

# Install dependencies
echo "📦 Installing logging dependencies..."
npm install pino@^8.16.1 pino-http@^8.5.0
npm install --save-dev pino-pretty@^10.2.3 @types/pino-http@^5.2.0

echo "✅ Dependencies installed!"

echo "📝 Available logging options:"
echo ""
echo "Option 1: Enhanced Morgan (already configured)"
echo "  - Color-coded HTTP requests"
echo "  - Response time tracking"
echo "  - Method-specific colors"
echo "  - Status code highlighting"
echo ""
echo "Option 2: Pino Logger (install dependencies above)"
echo "  - Structured JSON logging"
echo "  - Beautiful pretty-printing in development"
echo "  - High performance"
echo "  - Emoji indicators"
echo ""
echo "🚀 To use the enhanced logger, simply run:"
echo "   npm run dev"
echo ""
echo "🎨 Your logs will now be prettier with:"
echo "   • Color-coded methods (GET=green, POST=yellow, etc.)"
echo "   • Status code colors (2xx=green, 4xx=yellow, 5xx=red)"
echo "   • Response time highlighting"
echo "   • Structured formatting"
echo ""
echo "Done! 🎉" 