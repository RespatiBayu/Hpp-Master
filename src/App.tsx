/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import MainApp from "./MainApp";
import { AppProvider } from "./store/AppContext";

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
