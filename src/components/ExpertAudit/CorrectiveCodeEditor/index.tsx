// Re-export the SmartConfigurator as the main component
export { SmartConfigurator as CorrectiveCodeEditor } from './SmartConfigurator';
export { SmartConfigurator } from './SmartConfigurator';

// Keep the old types for backward compatibility
export type { FixConfig, AttributionConfig, ViewMode } from './SmartConfigurator/types';
