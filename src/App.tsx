import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import {Controller, useForm} from 'react-hook-form'
import {IFieldDefinition, IPromptForm} from './types/form'
import {useEffect, useState} from 'react'
import axios from 'axios'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const TEMPLATES_STORAGE_KEY = 'promptTemplates'

interface ITemplate {
    name: string;
    contents: {
        id: string;
        text: string;
        name: string;
        fields: IFieldDefinition[];
    }[];
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

function App() {
    const [templates, setTemplates] = useState<ITemplate[]>(() => {
        const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY)
        return saved ? JSON.parse(saved) : [{
            name: 'Промпт 1',
            contents: [{
                id: crypto.randomUUID(),
                text: '',
                name: 'Промпт 1',
                fields: []
            }],
            jsonData: undefined,
            jsonPath: '',
            apiUrl: '',
            apiMethod: 'POST' as const
        }]
    })

    const [activeTab, setActiveTab] = useState(0)
    const [fields, setFields] = useState<IFieldDefinition[]>([])
    const [template, setTemplate] = useState<string>('')
    const {control, handleSubmit, reset, getValues} = useForm<IPromptForm>()
    const [generatedPrompt, setGeneratedPrompt] = useState<string>('')
    const [editingTab, setEditingTab] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [isConfigExpanded, setIsConfigExpanded] = useState(false)
    const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
    const [editingPromptName, setEditingPromptName] = useState('')
    const [isPromptsExpanded, setIsPromptsExpanded] = useState(true)
    const [draggedPromptId, setDraggedPromptId] = useState<string | null>(null)
    const [dragOverPromptId, setDragOverPromptId] = useState<string | null>(null)

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue)
    }

    const addNewTab = () => {
        const newTabIndex = templates.length
        setTemplates(prev => [...prev, {
            name: `Промпт ${prev.length + 1}`,
            contents: [{id: crypto.randomUUID(), text: '', name: 'Промпт 1', fields: []}],
            jsonData: undefined,
            jsonPath: '',
            apiUrl: '',
            apiMethod: 'POST' as const
        }])
        setActiveTab(newTabIndex)
    }

    const removeTab = (index: number, event: React.MouseEvent) => {
        event.stopPropagation()
        if (templates.length > 1) {
            const newTemplates = templates.filter((_, i) => i !== index)
            setTemplates(newTemplates)

            // Определяем новый активный индекс
            const newActiveTab = index >= newTemplates.length ? newTemplates.length - 1 : index
            setActiveTab(newActiveTab)
        }
    }

    // Сохраняем шаблоны в localStorage при изменении
    useEffect(() => {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
    }, [templates])

    const isColorCode = (str: string) => {
        // Удаляем все пробелы и переносы строк из строки
        const cleanStr = str.replace(/[\s\n]+/g, '')
        return /^#[A-Fa-f0-9]{6}$/.test(cleanStr)
    }

    const parseTemplate = (text: string) => {
        const regex = /\[([^:\]]+):\s*([^\]]+)\]/g
        let match
        const newFields: IFieldDefinition[] = []

        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0]
            const label = match[1].trim()
            let options = match[2]
                ? match[2]
                    .split(/,(?![^(]*\))/)
                    .map(opt => opt.trim())
                    .filter(opt => opt.length > 0)
                : ['Option 1', 'Option 2', 'Option 3']

            const hasColors = options.some(opt => {
                const cleanOpt = opt.replace(/[\s\n]+/g, '')
                return /^#[A-Fa-f0-9]{6}$/.test(cleanOpt)
            })

            if (hasColors) {
                options = options.map(opt => opt.replace(/[\s\n]+/g, ''))
            }

            newFields.push({
                name: label.toLowerCase().replace(/\s+/g, '_'),
                label: label,
                options: options,
                start: match.index,
                end: match.index + fullMatch.length
            })
        }

        return newFields
    }

    // Парсим шаблон при изменении текста
    useEffect(() => {
        if (templates[activeTab]?.contents) {
            // Собираем все уникальные поля из всех промптов
            const allFields = templates[activeTab].contents.reduce((acc, content) => {
                if (content.fields && content.fields.length > 0) {
                    content.fields.forEach(field => {
                        const existingField = acc.find(f => f.name === field.name)
                        if (!existingField) {
                            acc.push(field)
                        }
                    })
                } else if (content.text) {
                    // Если поля не определены, но есть текст, парсим их
                    const parsedFields = parseTemplate(content.text)
                    parsedFields.forEach(field => {
                        const existingField = acc.find(f => f.name === field.name)
                        if (!existingField) {
                            acc.push(field)
                        }
                    })
                }
                return acc
            }, [] as IFieldDefinition[])

            setFields(allFields)

            if (allFields.length > 0) {
                const defaultValues = allFields.reduce((acc, field) => {
                    acc[field.name] = field.options[0] || ''
                    return acc
                }, {} as IPromptForm)

                reset(defaultValues)
            }
        }
    }, [templates[activeTab]?.contents, reset])

    const handleJsonInput = (jsonText: string) => {
        try {
            const jsonData = JSON.parse(jsonText)
            setTemplates(prev => prev.map((t, i) =>
                i === activeTab ? {
                    ...t,
                    jsonData,
                } : t
            ))
        } catch (error) {
            console.error('Error parsing JSON:', error)
            alert('Invalid JSON format')
        }
    }

    const handleJsonPathChange = (path: string) => {
        setTemplates(prev => prev.map((t, i) =>
            i === activeTab ? {...t, jsonPath: path} : t
        ))
    }

    const handleApiUrlChange = (url: string) => {
        try {
            // Проверяем, является ли URL валидным
            if (url && !url.startsWith('http')) {
                url = `http://${url}`
            }
            new URL(url) // Проверка валидности URL

            setTemplates(prev => prev.map((t, i) =>
                i === activeTab ? {...t, apiUrl: url} : t
            ))
        } catch (error) {
            console.error('Invalid URL:', error)
            // Можно добавить визуальное отображение ошибки
        }
    }

    const handleApiMethodChange = (method: 'GET' | 'POST') => {
        setTemplates(prev => prev.map((t, i) =>
            i === activeTab ? {...t, apiMethod: method} : t
        ))
    }

    const generatePrompt = (data: IPromptForm) => {
        const results = templates[activeTab].contents.map(content => {
            let result = content.text
            fields.forEach(field => {
                const pattern = new RegExp(`\\[${field.label}(?::\\s*[\\s\\S]*?)\\]`, 'g')
                result = result.replace(pattern, data[field.name] || '')
            })
            return result
        })

        const combinedResult = results.join('\n')
        setGeneratedPrompt(combinedResult)
        return combinedResult
    }

    const onSubmit = async (data: IPromptForm) => {
        const result = generatePrompt(data)

        const activeTemplate = templates[activeTab]
        console.log('Active template:', activeTemplate)

        if (activeTemplate.jsonData && activeTemplate.jsonPath && activeTemplate.apiUrl) {
            try {
                // Создаем копию JSON данных
                const jsonToSend = JSON.parse(JSON.stringify(activeTemplate.jsonData))
                console.log('Original JSON:', jsonToSend)

                // Устанавливаем значение по указанному пути
                const pathParts = activeTemplate.jsonPath.split('.')
                console.log('Path parts:', pathParts)

                let current = jsonToSend
                for (let i = 0; i < pathParts.length - 1; i++) {
                    if (!current[pathParts[i]]) {
                        throw new Error(`Path ${pathParts[i]} not found in JSON`)
                    }
                    current = current[pathParts[i]]
                }

                const lastPart = pathParts[pathParts.length - 1]
                if (current[lastPart] === undefined) {
                    throw new Error(`Final path ${lastPart} not found in JSON`)
                }

                current[lastPart] = result
                console.log('Modified JSON:', jsonToSend)

                console.log('Sending request to:', activeTemplate.apiUrl)
                console.log('With method:', activeTemplate.apiMethod)

                // Отправляем запрос
                const response = await axios({
                    method: activeTemplate.apiMethod || 'POST',
                    url: activeTemplate.apiUrl,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    data: jsonToSend,
                    // Добавляем timeout и другие настройки
                    timeout: 10000,
                    validateStatus: (status) => status < 500, // Принимаем все статусы < 500
                })

                console.log('API Response:', response.data)

                // Сохраняем последний успешный запрос
                setTemplates(prev => prev.map((t, i) =>
                    i === activeTab ? {
                        ...t,
                        lastSuccessfulRequest: {
                            prompt: result,
                            fullJson: jsonToSend,
                            response: response.data
                        }
                    } : t
                ))
            } catch (error) {
                // Улучшенная обработка ошибок
                if (axios.isAxiosError(error)) {
                    console.error('Axios Error:', {
                        message: error.message,
                        status: error.response?.status,
                        data: error.response?.data,
                        config: {
                            url: error.config?.url,
                            method: error.config?.method,
                            headers: error.config?.headers,
                            data: error.config?.data
                        }
                    })
                } else {
                    console.error('Error:', error)
                }

                // Можно добавить отображение ошибки пользователю
                alert(`Error: ${error.message}`)
            }
        } else {
            console.log('Missing required fields:', {
                hasJsonData: !!activeTemplate.jsonData,
                jsonPath: activeTemplate.jsonPath,
                apiUrl: activeTemplate.apiUrl
            })
        }
    }

    const startEditing = (index: number, event: React.MouseEvent) => {
        event.stopPropagation()
        setEditingTab(index)
        setEditingName(templates[index].name)
    }

    const handleRename = (force: boolean = false) => {
        if (editingTab !== null && (force || editingName.trim())) {
            setTemplates(prev => prev.map((t, i) =>
                i === editingTab ? {...t, name: editingName} : t
            ))
            setEditingTab(null)
        }
    }

    const copyConfigFromPrevious = () => {
        if (activeTab > 0) {
            const prevTab = templates[activeTab - 1]
            setTemplates(prev => prev.map((t, i) =>
                i === activeTab ? {
                    ...t,
                    jsonData: prevTab.jsonData,
                    jsonPath: prevTab.jsonPath,
                    apiUrl: prevTab.apiUrl,
                    apiMethod: prevTab.apiMethod
                } : t
            ))
        }
    }

    // Добавляем функцию копирования в буфер обмена
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Можно добавить уведомление об успешном копировании
            console.log('Текст скопирован в буфер обмена')
        }).catch(err => {
            console.error('Ошибка при копировании:', err)
        })
    }

    const addPrompt = () => {
        setTemplates(prev => prev.map((t, i) =>
            i === activeTab ? {
                ...t,
                contents: [
                    ...(t.contents || []),
                    {
                        id: crypto.randomUUID(),
                        text: '',
                        name: `Промпт ${(t.contents?.length || 0) + 1}`,
                        fields: [] // Убедимся, что fields всегда инициализировано как пустой массив
                    }
                ]
            } : t
        ))
    }

    const removePrompt = (promptId: string) => {
        setTemplates(prev => prev.map((t, i) =>
            i === activeTab ? {
                ...t,
                contents: t.contents.filter(p => p.id !== promptId)
            } : t
        ).map(t => ({
            ...t,
            contents: t.contents?.length ? t.contents : [{
                id: crypto.randomUUID(),
                text: '',
                name: 'Промпт 1',
                fields: [] // Убедимся, что fields всегда инициализировано как пустой массив
            }]
        })))
    }

    const updatePrompt = (promptId: string, newText: string) => {
        setTemplates(prev => {
            const newTemplates = prev.map((t, i) =>
                i === activeTab ? {
                    ...t,
                    contents: (t.contents || []).map(p =>
                        p.id === promptId ? {
                            ...p,
                            text: newText,
                            fields: parseTemplate(newText) // Парсим поля для текущего промпта
                        } : p
                    )
                } : t
            );

            // Собираем все уникальные поля из всех промптов текущего таба
            if (newTemplates[activeTab]) {
                const allFields = newTemplates[activeTab].contents.reduce((acc, content) => {
                    // Добавляем проверку на существование полей
                    const contentFields = content.fields || []
                    contentFields.forEach(field => {
                        if (!acc.find(f => f.name === field.name)) {
                            acc.push(field)
                        }
                    })

                    // Если есть текст, но нет полей, парсим их
                    if (content.text && (!content.fields || content.fields.length === 0)) {
                        const parsedFields = parseTemplate(content.text)
                        parsedFields.forEach(field => {
                            if (!acc.find(f => f.name === field.name)) {
                                acc.push(field)
                            }
                        })
                    }

                    return acc
                }, [] as IFieldDefinition[])

                // Обновляем состояние полей
                setFields(allFields)

                // Инициализируем значения формы только если есть поля
                if (allFields.length > 0) {
                    const defaultValues = allFields.reduce((acc, field) => {
                        acc[field.name] = field.options[0] || ''
                        return acc
                    }, {} as IPromptForm)

                    reset(defaultValues)
                }
            }

            return newTemplates
        })
    }

    const renamePrompt = (promptId: string, newName: string) => {
        setTemplates(prev => prev.map((t, i) =>
            i === activeTab ? {
                ...t,
                contents: t.contents.map(p =>
                    p.id === promptId ? {...p, name: newName} : p
                )
            } : t
        ))
    }

    const handleDragStart = (promptId: string) => {
        setDraggedPromptId(promptId)
    }

    const handleDragOver = (e: React.DragEvent, promptId: string) => {
        e.preventDefault()
        if (draggedPromptId !== promptId) {
            setDragOverPromptId(promptId)
        }
    }

    const handleDragEnd = () => {
        if (draggedPromptId && dragOverPromptId) {
            setTemplates(prev => prev.map((t, i) => {
                if (i === activeTab) {
                    const contents = [...t.contents]
                    const draggedIndex = contents.findIndex(p => p.id === draggedPromptId)
                    const dropIndex = contents.findIndex(p => p.id === dragOverPromptId)

                    const [draggedPrompt] = contents.splice(draggedIndex, 1)
                    contents.splice(dropIndex, 0, draggedPrompt)

                    return {...t, contents}
                }
                return t
            }))
        }
        setDraggedPromptId(null)
        setDragOverPromptId(null)
    }

    return (
        <Box  sx={{m: 0, p: 0}} style={{width: "100vw"}}>
            <Paper sx={{mb: 3}}>
                <Box sx={{borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center'}}>
                    <Tabs

                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{flex: 1}}
                    >
                        {templates.map((t, index) => (
                            <Tab
                                key={index}
                                label={
                                    editingTab === index ? (
                                        <TextField
                                            size="small"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleRename(true)
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingTab(null)
                                                }
                                                e.stopPropagation()
                                            }}
                                            onBlur={(e) => {
                                                const relatedTarget = e.relatedTarget as HTMLElement
                                                if (!relatedTarget?.contains(e.currentTarget)) {
                                                    handleRename(true)
                                                }
                                            }}
                                            autoFocus
                                            sx={{
                                                '& .MuiInputBase-root': {
                                                    height: '32px',
                                                    color: 'inherit',
                                                    fontSize: 'inherit',
                                                }
                                            }}
                                        />
                                    ) : (
                                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                                            {t.name}
                                            <Box sx={{ml: 1, display: 'flex', gap: 0.5}}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => startEditing(index, e)}
                                                >
                                                    <EditIcon fontSize="small"/>
                                                </IconButton>
                                                {templates.length > 1 && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => removeTab(index, e)}
                                                    >
                                                        <CloseIcon fontSize="small"/>
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </Box>
                                    )
                                }
                            />
                        ))}
                    </Tabs>
                    <IconButton onClick={addNewTab} sx={{mr: 1}}>
                        <AddIcon/>
                    </IconButton>
                </Box>

                <Box sx={{p: 3}} >
                    <Accordion
                        expanded={isConfigExpanded}
                        onChange={(_, expanded) => setIsConfigExpanded(expanded)}
                        sx={{mb: 2}}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon/>}
                            sx={{
                                '& .MuiAccordionSummary-content': {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%'
                                }
                            }}
                        >
                            <Typography>
                                Configuration
                                {templates[activeTab]?.jsonData ? " (Valid JSON)" : ""}
                            </Typography>
                            {activeTab > 0 && (
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        copyConfigFromPrevious()
                                    }}
                                    title="Copy config from previous tab"
                                >
                                    <ContentCopyIcon fontSize="small"/>
                                </IconButton>
                            )}
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    placeholder="Paste your JSON here"
                                    value={(() => {
                                        const jsonData = templates[activeTab]?.jsonData
                                        return jsonData ? JSON.stringify(jsonData, null, 2) : ''
                                    })()}
                                    onChange={(e) => handleJsonInput(e.target.value)}
                                    error={templates[activeTab]?.jsonData === undefined}
                                    helperText={templates[activeTab]?.jsonData ? "Valid JSON" : ""}
                                    sx={{
                                        fontFamily: 'monospace',
                                    }}
                                />

                                <Box sx={{display: 'grid', gap: 2, gridTemplateColumns: 'repeat(2, 1fr)'}}>
                                    <TextField
                                        fullWidth
                                        label="JSON Path"
                                        placeholder="e.g., 30.inputs.prompt"
                                        value={templates[activeTab]?.jsonPath || ''}
                                        onChange={(e) => handleJsonPathChange(e.target.value)}
                                    />

                                    <TextField
                                        fullWidth
                                        label="API URL"
                                        placeholder="http://example.com/api"
                                        value={templates[activeTab]?.apiUrl || ''}
                                        onChange={(e) => handleApiUrlChange(e.target.value)}
                                    />

                                    <FormControl fullWidth>
                                        <InputLabel>HTTP Method</InputLabel>
                                        <Select
                                            value={templates[activeTab]?.apiMethod || 'POST'}
                                            onChange={(e) => handleApiMethodChange(e.target.value as 'GET' | 'POST')}
                                            label="HTTP Method"
                                        >
                                            <MenuItem value="GET">GET</MenuItem>
                                            <MenuItem value="POST">POST</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion
                        expanded={isPromptsExpanded}
                        onChange={(_, expanded) => setIsPromptsExpanded(expanded)}
                        sx={{mb: 2}}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon/>}
                            sx={{
                                '& .MuiAccordionSummary-content': {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%'
                                }
                            }}
                        >
                            <Typography>Промпты</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                {templates[activeTab]?.contents?.map((content) => (
                                    <Box
                                        key={content.id}
                                        draggable
                                        onDragStart={() => handleDragStart(content.id)}
                                        onDragOver={(e) => handleDragOver(e, content.id)}
                                        onDragEnd={handleDragEnd}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 1,
                                            cursor: 'move',
                                            backgroundColor: dragOverPromptId === content.id ? 'action.hover' : 'transparent',
                                            transition: 'background-color 0.2s',
                                            p: 1,
                                            borderRadius: 1
                                        }}
                                    >
                                        <Typography variant="subtitle1"
                                                    sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                            <Box
                                                component="span"
                                                sx={{
                                                    cursor: 'grab',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    color: 'text.secondary',
                                                    '&:active': {
                                                        cursor: 'grabbing'
                                                    }
                                                }}
                                            >
                                                ⋮⋮
                                            </Box>
                                            {editingPromptId === content.id ? (
                                                <TextField
                                                    size="small"
                                                    value={editingPromptName}
                                                    onChange={(e) => setEditingPromptName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            renamePrompt(content.id, editingPromptName)
                                                            setEditingPromptId(null)
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setEditingPromptId(null)
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (editingPromptName.trim()) {
                                                            renamePrompt(content.id, editingPromptName)
                                                        }
                                                        setEditingPromptId(null)
                                                    }}
                                                    autoFocus
                                                    sx={{
                                                        '& .MuiInputBase-root': {
                                                            height: '32px',
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <>
                                                    {content.name}
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setEditingPromptId(content.id)
                                                            setEditingPromptName(content.name)
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small"/>
                                                    </IconButton>
                                                </>
                                            )}
                                        </Typography>
                                        <Box sx={{display: 'flex', gap: 1, alignItems: 'start'}}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                rows={4}
                                                placeholder="Введите текст промпта"
                                                value={content.text || ''}
                                                onChange={(e) => updatePrompt(content.id, e.target.value)}
                                            />
                                            {(templates[activeTab]?.contents?.length || 0) > 1 && (
                                                <IconButton
                                                    onClick={() => removePrompt(content.id)}
                                                    size="small"
                                                    sx={{mt: 1}}
                                                >
                                                    <CloseIcon/>
                                                </IconButton>
                                            )}
                                        </Box>
                                    </Box>
                                ))}

                                <Button
                                    startIcon={<AddIcon/>}
                                    onClick={addPrompt}
                                    variant="outlined"
                                    sx={{alignSelf: 'flex-start'}}
                                >
                                    Добавить промпт
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    {fields.length > 0 && (
                        <Paper sx={{p: 3, mb: 3, position: 'relative'}}>
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <Box sx={{
                                    maxHeight: '60vh',
                                    overflowY: 'auto',
                                    pb: 10
                                }}>
                                    <Box sx={{display: 'grid', gap: 2, gridTemplateColumns: 'repeat(2, 1fr)'}}>
                                        {templates[activeTab]?.contents?.map((content) => {
                                            // Фильтруем поля, которые используются в данном промпте
                                            const promptFields = fields.filter(field =>
                                                content.text.includes(`[${field.label}:`)
                                            )

                                            return promptFields.length > 0 ? (
                                                <Box
                                                    key={content.id}
                                                    sx={{
                                                        gridColumn: '1 / -1',
                                                        mb: 3
                                                    }}
                                                >
                                                    <Typography
                                                        variant="h6"
                                                        sx={{
                                                            mb: 2,
                                                            pb: 1,
                                                            borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
                                                        }}
                                                    >
                                                        {content.name}
                                                    </Typography>
                                                    <Box sx={{
                                                        display: 'grid',
                                                        gap: 2,
                                                        gridTemplateColumns: 'repeat(2, 1fr)'
                                                    }}>
                                                        {promptFields.map((field) => (
                                                            <Controller
                                                                key={`${content.id}-${field.name}`}
                                                                name={field.name}
                                                                control={control}
                                                                defaultValue={field.options[0] || ''}
                                                                render={({field: {onChange, value}}) => (
                                                                    <Box>
                                                                        <TextField
                                                                            select
                                                                            label={field.label}
                                                                            value={value}
                                                                            onChange={(e) => {
                                                                                onChange(e)
                                                                                const currentValues = fields.reduce((acc, f) => {
                                                                                    acc[f.name] = f.name === field.name ? e.target.value : getValues(f.name)
                                                                                    return acc
                                                                                }, {} as IPromptForm)
                                                                                generatePrompt(currentValues)
                                                                            }}
                                                                            fullWidth
                                                                            required
                                                                        >
                                                                            {field.options.map((option) => {
                                                                                const isColor = isColorCode(option)
                                                                                const isColorPalette = option.includes('#') && option.split(/\s+/).every(color => isColorCode(color))

                                                                                return (
                                                                                    <MenuItem
                                                                                        key={option}
                                                                                        value={option}
                                                                                        sx={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            gap: 1
                                                                                        }}
                                                                                    >
                                                                                        {isColorPalette ? (
                                                                                            <Box sx={{
                                                                                                display: 'flex',
                                                                                                gap: 0.5,
                                                                                                alignItems: 'center'
                                                                                            }}>
                                                                                                {option.split(/\s+/).map((color, i) => (
                                                                                                    <Box
                                                                                                        key={i}
                                                                                                        sx={{
                                                                                                            width: 12,
                                                                                                            height: 12,
                                                                                                            backgroundColor: color,
                                                                                                            borderRadius: '2px',
                                                                                                            border: '1px solid rgba(0, 0, 0, 0.12)'
                                                                                                        }}
                                                                                                    />
                                                                                                ))}
                                                                                            </Box>
                                                                                        ) : isColor ? (
                                                                                            <Box
                                                                                                sx={{
                                                                                                    width: 20,
                                                                                                    height: 20,
                                                                                                    borderRadius: '4px',
                                                                                                    backgroundColor: option,
                                                                                                    border: '1px solid rgba(0, 0, 0, 0.12)',
                                                                                                    flexShrink: 0
                                                                                                }}
                                                                                            />
                                                                                        ) : null}
                                                                                        {option}
                                                                                    </MenuItem>
                                                                                )
                                                                            })}
                                                                        </TextField>
                                                                        {field.options.some(opt => isColorCode(opt)) && (
                                                                            <Box sx={{
                                                                                display: 'flex',
                                                                                gap: 0.5,
                                                                                mt: 1,
                                                                                flexWrap: 'wrap'
                                                                            }}>
                                                                                {field.options.map((option) => (
                                                                                    isColorCode(option) && (
                                                                                        <Box
                                                                                            key={option}
                                                                                            sx={{
                                                                                                width: 24,
                                                                                                height: 24,
                                                                                                borderRadius: '4px',
                                                                                                backgroundColor: option,
                                                                                                border: '1px solid rgba(0, 0, 0, 0.12)',
                                                                                                cursor: 'pointer',
                                                                                                '&:hover': {
                                                                                                    transform: 'scale(1.1)',
                                                                                                },
                                                                                                transition: 'transform 0.2s'
                                                                                            }}
                                                                                            onClick={() => {
                                                                                                onChange({target: {value: option}})
                                                                                                const currentValues = fields.reduce((acc, f) => {
                                                                                                    acc[f.name] = f.name === field.name ? option : getValues(f.name)
                                                                                                    return acc
                                                                                                }, {} as IPromptForm)
                                                                                                generatePrompt(currentValues)
                                                                                            }}
                                                                                        />
                                                                                    )
                                                                                ))}
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                )}
                                                            />
                                                        ))}
                                                    </Box>
                                                </Box>
                                            ) : null
                                        })}
                                    </Box>
                                </Box>

                                <Box sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    p: 3,
                                    background: 'white',
                                    borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                                    zIndex: 1,
                                }}>
                                    <Button variant="contained" type="submit" fullWidth>
                                        Сгенерировать Промпт
                                    </Button>
                                </Box>
                            </form>
                        </Paper>
                    )}
                </Box>
            </Paper>

            <Paper sx={{p: 3}}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1
                }}>
                    <Typography variant="h6">
                        Текст Промпта:
                    </Typography>
                    <IconButton
                        onClick={() => copyToClipboard(generatedPrompt || template)}
                        size="small"
                        title="Copy to clipboard"
                    >
                        <ContentCopyIcon fontSize="small"/>
                    </IconButton>
                </Box>
                <TextField
                    multiline
                    fullWidth
                    rows={6}
                    value={generatedPrompt || template}
                    variant="outlined"
                    InputProps={{
                        sx: {
                            backgroundColor: generatedPrompt ? 'inherit' : 'action.hover'
                        }
                    }}
                />
            </Paper>
        </Box>
    )
}

export default App
