#!/bin/bash

# Phase 1 Backend Foundation Verification Script
# Run this from your vale-backend directory

echo "🚀 Starting Phase 1 Verification for Vale Backend..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verification results
TESTS_PASSED=0
TOTAL_TESTS=8

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

echo -e "${BLUE}1. Checking Project Structure...${NC}"
# Check if essential directories exist
if [ -d "src/controllers" ] && [ -d "src/models" ] && [ -d "src/routes" ] && [ -d "src/services" ] && [ -d "__tests__" ]; then
    print_result 0 "Project structure is correct"
else
    print_result 1 "Project structure is missing required directories"
fi

echo -e "${BLUE}2. Checking Dependencies...${NC}"
# Check if package.json has required dependencies
if npm list express mongoose jsonwebtoken bcryptjs jest --depth=0 >/dev/null 2>&1; then
    print_result 0 "All required dependencies are installed"
else
    print_result 1 "Missing required dependencies"
fi

echo -e "${BLUE}3. TypeScript Compilation...${NC}"
# Check TypeScript compilation
if npm run build >/dev/null 2>&1; then
    print_result 0 "TypeScript compiles without errors"
else
    print_result 1 "TypeScript compilation failed"
fi

echo -e "${BLUE}4. ESLint Code Quality...${NC}"
# Check ESLint with backend-specific rules
if npm run lint >/dev/null 2>&1; then
    print_result 0 "ESLint passes with backend rules (no circular dependencies)"
else
    print_result 1 "ESLint found code quality issues or circular dependencies"
fi

echo -e "${BLUE}5. Unit Tests...${NC}"
# Run unit tests
if npm run test:unit >/dev/null 2>&1; then
    print_result 0 "All unit tests pass"
else
    print_result 1 "Unit tests failing"
fi

echo -e "${BLUE}6. Integration Tests...${NC}"
# Run integration tests
if npm run test:integration >/dev/null 2>&1; then
    print_result 0 "All integration tests pass"
else
    print_result 1 "Integration tests failing"
fi

echo -e "${BLUE}7. Test Coverage...${NC}"
# Check test coverage
COVERAGE_OUTPUT=$(npm run test:coverage 2>/dev/null | grep "All files")
if [ ! -z "$COVERAGE_OUTPUT" ]; then
    # Extract coverage percentage - look for pattern like "91.8" or "91"
    COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -o '[0-9]\+\.[0-9]\+' | head -1)
    if [ -z "$COVERAGE" ]; then
        COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -o '[0-9]\+' | head -1)
    fi
    
    if [ ! -z "$COVERAGE" ] && [ $(echo "$COVERAGE >= 80" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
        print_result 0 "Test coverage is ${COVERAGE}% (≥80% required)"
    else
        print_result 1 "Test coverage is ${COVERAGE}% (below 80% requirement)"
    fi
else
    print_result 1 "Could not determine test coverage"
fi

echo -e "${BLUE}8. API Endpoints Verification...${NC}"
# Start server in background and test endpoints
npm start &
SERVER_PID=$!
sleep 5

# Test if server is running
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    API_WORKING=1
    
    # Test key endpoints
    echo "  Testing Authentication endpoints..."
    REGISTER_TEST=$(curl -s -X POST http://localhost:3000/api/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"password123","profile":{"name":"Test User"}}' \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$REGISTER_TEST" = "201" ] || [ "$REGISTER_TEST" = "400" ]; then
        echo "    ✅ Register endpoint responding"
    else
        echo "    ❌ Register endpoint not working"
        API_WORKING=0
    fi
    
    echo "  Testing Location endpoints..."
    LOCATIONS_TEST=$(curl -s http://localhost:3000/api/locations -w "%{http_code}" -o /dev/null)
    if [ "$LOCATIONS_TEST" = "200" ] || [ "$LOCATIONS_TEST" = "401" ]; then
        echo "    ✅ Locations endpoint responding"
    else
        echo "    ❌ Locations endpoint not working"
        API_WORKING=0
    fi
    
    # Test duplicate location prevention
    echo "  Testing Location duplicate prevention..."
    # First create a location
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@vale.com","password":"admin123"}')
    
    if echo "$LOGIN_RESPONSE" | grep -q "token"; then
        TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        
        # Create first location
        CREATE_LOCATION=$(curl -s -X POST http://localhost:3000/api/locations \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"name":"Test Location","address":"Test Address","coordinates":{"latitude":52.3732,"longitude":4.8936}}' \
            -w "%{http_code}" -o /dev/null)
        
        # Try to create duplicate
        DUPLICATE_TEST=$(curl -s -X POST http://localhost:3000/api/locations \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"name":"Test Location","address":"Test Address","coordinates":{"latitude":52.3732,"longitude":4.8936}}' \
            -w "%{http_code}" -o /dev/null)
        
        if [ "$DUPLICATE_TEST" = "400" ]; then
            echo "    ✅ Duplicate prevention working"
        else
            echo "    ❌ Duplicate prevention not working"
            API_WORKING=0
        fi
    else
        echo "    ⚠️  Could not test duplicate prevention (admin login failed)"
    fi
    
    print_result $API_WORKING "API endpoints are functional with duplicate prevention"
else
    print_result 1 "Server failed to start or is not responding"
fi

# Clean up
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "=================================================="
echo -e "${BLUE}Phase 1 Verification Results:${NC}"
echo "=================================================="

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 PHASE 1 COMPLETE! All verification tests passed (${TESTS_PASSED}/${TOTAL_TESTS})${NC}"
    echo ""
    echo -e "${GREEN}✅ Backend Foundation is solid and ready for Phase 2!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Commit all changes to git"
    echo "2. Tag release: git tag v1.0.0-phase1"  
    echo "3. Proceed to Phase 2: Admin Dashboard & Frontend Foundation"
    exit 0
else
    echo -e "${RED}❌ PHASE 1 INCOMPLETE! (${TESTS_PASSED}/${TOTAL_TESTS} tests passed)${NC}"
    echo ""
    echo -e "${YELLOW}Issues to fix before proceeding to Phase 2:${NC}"
    
    if [ $TESTS_PASSED -lt 4 ]; then
        echo "- Fix basic project setup and dependencies"
    fi
    if [ $TESTS_PASSED -lt 6 ]; then
        echo "- Resolve failing tests"
    fi
    if [ $TESTS_PASSED -lt 7 ]; then
        echo "- Improve test coverage to meet 80% requirement"
    fi
    if [ $TESTS_PASSED -lt 8 ]; then
        echo "- Fix API endpoint issues"
    fi
    
    echo ""
    echo "Run individual checks:"
    echo "  npm run test:unit"
    echo "  npm run test:integration" 
    echo "  npm run test:coverage"
    echo "  npm run build"
    echo "  npm run lint"
    
    exit 1
fi 