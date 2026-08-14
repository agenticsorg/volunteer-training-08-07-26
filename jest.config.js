module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.js'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
  },
};
