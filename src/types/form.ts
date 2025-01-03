export interface IPromptForm {
  [key: string]: string;
}

export interface IFieldDefinition {
  name: string;
  label: string;
  options: string[];
  start: number;
  end: number;
}

export interface ITemplate {
  name: string;
  content: string;
  jsonData?: any;
  jsonPath?: string;
  apiUrl?: string;
  apiMethod?: 'GET' | 'POST';
  jsonFileName?: string;
  lastSuccessfulRequest?: {
    prompt: string;
    fullJson: any;
    response: any;
  };
} 