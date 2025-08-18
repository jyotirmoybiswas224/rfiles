import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import OutOfNetworkPage from './OutOfNetworkPage';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('OutOfNetworkPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('does not create navigation loop when already on edit route', () => {
    // Test that the component doesn't navigate when already on the edit route
    render(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/123/edit']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    // Wait for component to mount and any effects to run
    waitFor(() => {
      // Verify navigate was not called (no redirect loop)
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  test('navigates to edit route when not already there', () => {
    // Test that the component navigates to edit route when needed
    render(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/123']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    // Wait for component to mount and effects to run
    waitFor(() => {
      // Verify navigate was called to redirect to edit route
      expect(mockNavigate).toHaveBeenCalledWith('/admin/subcontractor/add-subcontractor/123/edit');
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  test('renders loading state initially', () => {
    render(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/123/edit']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    // Check that loading state is shown
    expect(screen.getByText('Loading subcontractor data...')).toBeInTheDocument();
  });

  test('renders form after loading when on edit route', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/123/edit']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Edit Subcontractor')).toBeInTheDocument();
    });

    // Check that form fields are rendered and enabled
    expect(screen.getByDisplayValue('Subcontractor 123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('subcontractor123@example.com')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  test('renders message when no ID is provided', () => {
    render(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    expect(screen.getByText('No subcontractor ID provided. Please select a subcontractor to edit.')).toBeInTheDocument();
  });

  test('page reload does not cause infinite redirects', () => {
    // Simulate page reload by rendering component multiple times on same route
    const TestComponent = () => (
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/123/edit']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    const { rerender } = render(<TestComponent />);
    
    // Simulate multiple rerenders (like what happens during page reload)
    rerender(<TestComponent />);
    rerender(<TestComponent />);
    rerender(<TestComponent />);

    waitFor(() => {
      // Navigate should not be called because we're already on the edit route
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});

// Integration test to verify the complete flow
describe('OutOfNetworkPage Integration', () => {
  test('complete flow from base route to edit route works correctly', async () => {
    // Start on base route without /edit
    const { rerender } = render(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/456']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    // Verify navigation to edit route is triggered
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/subcontractor/add-subcontractor/456/edit');
    });

    // Simulate navigation by rerendering on edit route
    rerender(
      <MemoryRouter initialEntries={['/admin/subcontractor/add-subcontractor/456/edit']}>
        <OutOfNetworkPage />
      </MemoryRouter>
    );

    // Wait for loading to complete and verify form is rendered
    await waitFor(() => {
      expect(screen.getByText('Edit Subcontractor')).toBeInTheDocument();
    });

    // Verify no additional navigations occur
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});