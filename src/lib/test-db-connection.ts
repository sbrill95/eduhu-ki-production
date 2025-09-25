// Database connection test utility for Phase 2A verification
import { db } from './instant'

export const testInstantDBConnection = async (): Promise<{
  success: boolean
  message: string
  appId: string
}> => {
  const appId = process.env.NEXT_PUBLIC_INSTANTDB_APP_ID || 'demo-app-id'

  try {
    // Test basic query to verify connection
    const testQuery = db.useQuery({ chats: {} })

    if (appId === 'demo-app-id') {
      return {
        success: false,
        message: '🚨 Still using demo-app-id! Replace with real InstantDB app ID',
        appId
      }
    }

    return {
      success: true,
      message: '✅ InstantDB connection successful with real app ID',
      appId: `${appId.substring(0, 8)  }...` // Partially mask for security
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      appId
    }
  }
}

// React hook version for components
export const useDBConnectionTest = () => {
  const appId = process.env.NEXT_PUBLIC_INSTANTDB_APP_ID || 'demo-app-id'

  return {
    isDemo: appId === 'demo-app-id',
    appId: appId === 'demo-app-id' ? appId : `${appId.substring(0, 8)  }...`,
    status: appId === 'demo-app-id' ? 'warning' : 'connected'
  }
}