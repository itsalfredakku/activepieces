import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createFolderAction } from './lib/actions/create-folder';
import { createListAction } from './lib/actions/create-list';

export const microsoftSharePointAuth = PieceAuth.OAuth2({
	description: 'Authentication for Microsoft SharePoint',
	authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
	tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
	required: true,
	scope: ['openid', 'email', 'profile', 'offline_access', 'Sites.Manage.All', 'Files.ReadWrite'],
});

export const microsoftSharePoint = createPiece({
	displayName: 'Microsoft SharePoint',
	auth: microsoftSharePointAuth,
	minimumSupportedRelease: '0.20.0',
	logoUrl: 'https://cdn.activepieces.com/pieces/microsoft-sharepoint.png',
	categories: [PieceCategory.CONTENT_AND_FILES],
	authors: ['kishanprmr'],
	actions: [createFolderAction, createListAction],
	triggers: [],
});
