/**
 * Cognito Post Confirmation Lambda Trigger
 * Automatically adds new users to the 'Users' group if they don't have a role yet
 * Ensures role exclusivity (Admin, Moderators, Users are mutually exclusive)
 */

const { 
  CognitoIdentityProviderClient, 
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({});

// Define role groups in priority order
const ROLE_GROUPS = ['Admin', 'Moderators', 'Users'];

exports.handler = async (event) => {
  console.log('Post confirmation trigger event:', JSON.stringify(event, null, 2));

  const userPoolId = event.userPoolId;
  const username = event.userName;
  const triggerSource = event.triggerSource;

  console.log(`Trigger source: ${triggerSource}, User: ${username}`);

  try {
    // Check if user already has any role group
    const listGroupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    });

    const groupsResponse = await client.send(listGroupsCommand);
    const existingGroups = groupsResponse.Groups || [];
    const existingRoleGroups = existingGroups
      .map(g => g.GroupName)
      .filter(name => ROLE_GROUPS.includes(name));

    console.log(`User ${username} existing role groups:`, existingRoleGroups);

    // Only add to 'Users' group if user has no role group yet
    if (existingRoleGroups.length === 0) {
      const command = new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: 'Users',
      });

      await client.send(command);
      console.log(`Successfully added user ${username} to 'Users' group`);
    } else {
      console.log(`User ${username} already has role group(s): ${existingRoleGroups.join(', ')}, skipping auto-assignment`);
    }
  } catch (error) {
    console.error('Error in post confirmation trigger:', error);
    // Don't fail the authentication flow if group assignment fails
  }

  // Return the event to allow the user to sign in
  return event;
};
