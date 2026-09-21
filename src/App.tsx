import React from 'react';
import AppRoutes from './routes';
import useTheme from './hooks/useTheme';

const App: React.FC = () => {
  // Keeps the `.dark` class and the persisted preference in sync app-wide.
  useTheme();

  return <AppRoutes />;
};

export default App;
