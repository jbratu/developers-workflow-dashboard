export interface ScreenshotConfig {
  format: 'png' | 'jpg' | 'jpeg';
  quality: number;  // 1-100, only used for JPG
  captureInterval: number;  // seconds
  outputFolder: string;
}

export interface Config {
  screenshot: ScreenshotConfig;
}

const DEFAULT_CONFIG: Config = {
  screenshot: {
    format: 'png',
    quality: 90,
    captureInterval: 30,
    outputFolder: './screenshots'
  }
};

export async function loadConfig(): Promise<Config> {
  try {
    const configText = await Deno.readTextFile('./config.json');
    const userConfig = JSON.parse(configText) as Partial<Config>;
    
    // Merge with defaults and validate
    const config: Config = {
      screenshot: {
        ...DEFAULT_CONFIG.screenshot,
        ...userConfig.screenshot
      }
    };
    
    // Validate settings
    validateConfig(config);
    
    console.log('Configuration loaded:');
    console.log(`  Format: ${config.screenshot.format.toUpperCase()}`);
    if (config.screenshot.format === 'jpg' || config.screenshot.format === 'jpeg') {
      console.log(`  Quality: ${config.screenshot.quality}%`);
    }
    console.log(`  Capture Interval: ${config.screenshot.captureInterval} seconds`);
    console.log(`  Output Folder: ${config.screenshot.outputFolder}`);
    
    return config;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log('config.json not found, using default settings');
      
      // Create default config file
      await Deno.writeTextFile('./config.json', JSON.stringify(DEFAULT_CONFIG, null, 2));
      console.log('Created config.json with default settings');
      
      return DEFAULT_CONFIG;
    }
    
    console.error('Error loading config:', error);
    console.log('Using default settings');
    return DEFAULT_CONFIG;
  }
}

function validateConfig(config: Config): void {
  const { screenshot } = config;
  
  // Validate format
  if (!['png', 'jpg', 'jpeg'].includes(screenshot.format)) {
    throw new Error(`Invalid screenshot format: ${screenshot.format}. Must be 'png', 'jpg', or 'jpeg'`);
  }
  
  // Validate quality
  if (screenshot.quality < 1 || screenshot.quality > 100) {
    throw new Error(`Invalid quality: ${screenshot.quality}. Must be between 1 and 100`);
  }
  
  // Validate capture interval
  if (screenshot.captureInterval < 1) {
    throw new Error(`Invalid capture interval: ${screenshot.captureInterval}. Must be at least 1 second`);
  }
  
  // Validate output folder
  if (!screenshot.outputFolder || screenshot.outputFolder.trim() === '') {
    throw new Error('Output folder cannot be empty');
  }
}