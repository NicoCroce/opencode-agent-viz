import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@app/Application/Components/ui/sonner';
import Routes from '@app/Infrastructure/Routes';

function App() {
  return (
    <BrowserRouter>
      <Routes />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
