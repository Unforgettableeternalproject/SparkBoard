/**
 * Cognito Post Confirmation Lambda Trigger
 * Automatically adds new users to the 'Users' group
 */

const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  console.log('Post confirmation trigger event:', JSON.stringify(event, null, 2));

  const userPoolId = event.userPoolId;
  const username = event.userName;
  const triggerSource = event.triggerSource;

  // Only process confirmed users (not pre-signup)
  if (triggerSource === 'PostConfirmation_ConfirmSignUp' || triggerSource === 'PostConfirmation_ConfirmForgotPassword') {
    try {
      // Add user to 'Users' group by default
      const command = new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: 'Users',
      });

      await client.send(command);
      console.log(`Successfully added user ${username} to 'Users' group`);
    } catch (error) {
      console.error('Error adding user to group:', error);
      // Don't fail the authentication flow if group assignment fails
    }
  }

  // Return the event to allow the user to sign in
  return event;
};
