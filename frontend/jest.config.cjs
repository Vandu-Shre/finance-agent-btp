/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@ui5/webcomponents-react$': '<rootDir>/src/__mocks__/@ui5/webcomponents-react.tsx',
    '^@ui5/webcomponents/dist/Assets\\.js$': '<rootDir>/src/__mocks__/emptyModule.js',
    '^@ui5/webcomponents-react/dist/Assets\\.js$': '<rootDir>/src/__mocks__/emptyModule.js',
    '^@ui5/webcomponents-icons/dist/AllIcons\\.js$': '<rootDir>/src/__mocks__/emptyModule.js',
    '^@ui5/webcomponents-base/dist/config/Theme\\.js$': '<rootDir>/src/__mocks__/theme.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/__mocks__/**',
    '!src/setupTests.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
