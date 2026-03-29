/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

