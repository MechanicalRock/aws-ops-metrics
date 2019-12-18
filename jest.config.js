module.exports = {
  "collectCoverageFrom": [
    "src/**/*.{js,jsx,ts,tsx}"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    }
  },
  "testMatch": [
    "<rootDir>/test/?(*.)(spec|test).ts?(x)",
    "<rootDir>/test/?(*.)(spec|test).js?(x)",
    "**/*.steps.ts?(x)"
  ],
  "testEnvironment": "node",
  "testURL": "http://localhost",
  "roots": [
    "<rootDir>/src/",
    "<rootDir>/test/"
  ],
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "transformIgnorePatterns": [
    "[/\\\\]node_modules[/\\\\].+\\.(js|jsx|ts|tsx)$"
  ],
  "moduleNameMapper": {
    "^react-native$": "react-native-web"
  },
  "moduleFileExtensions": [
    "js",
    "ts",
    "tsx",
    "json",
    "node"
  ],
  "globals": {
    "ts-jest": {
      "tsConfigFile": "tsconfig.test.json"
    }
  },
  "verbose": true
}
