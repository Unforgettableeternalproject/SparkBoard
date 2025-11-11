# SparkBoard RBAC Specification

## 📋 Overview

SparkBoard implements a three-tier Role-Based Access Control (RBAC) system using AWS Cognito User Groups. This document defines the complete permission matrix for all roles across features.

## 👥 User Roles

### 1. **Admin**
- **Cognito Group**: `Admin`
- **Precedence**: 1 (highest)
- **Description**: Full system access including user management, monitoring, and all content management
- **Auto-assignment**: Manual (must be added to group by administrator)

### 2. **Moderators**
- **Cognito Group**: `Moderators`
- **Precedence**: 2
- **Description**: Content moderators with announcement management and task oversight
- **Auto-assignment**: Manual (must be added to group by administrator)

### 3. **Users**
- **Cognito Group**: `Users`
- **Precedence**: 3 (lowest)
- **Description**: Standard authenticated users with basic task and profile management
- **Auto-assignment**: Automatic (via Cognito PostConfirmation trigger)

## 🔐 Permission Matrix

### Tasks

| Action | Admin | Moderators | Users |
|--------|-------|------------|-------|
| View all tasks | ✅ | ✅ | ✅ |
| Create task | ✅ | ✅ | ✅ |
| Edit own task | ✅ | ✅ | ✅ |
| Edit any task | ✅ | ✅ | ❌ |
| Delete own task | ✅ | ✅ | ✅ |
| Delete any task | ✅ | ✅ | ❌ |
| Toggle own subtasks | ✅ | ✅ | ✅ |
| Toggle any subtasks | ✅ | ✅ | ❌ |

### Announcements

| Action | Admin | Moderators | Users |
|--------|-------|------------|-------|
| View announcements | ✅ | ✅ | ✅ |
| Create announcement | ✅ | ✅ | ❌ |
| Edit announcement | ✅ | ✅ | ❌ |
| Delete announcement | ✅ | ✅ | ❌ |
| Pin announcement | ✅ | ✅ | ❌ |
| Set priority | ✅ | ✅ | ❌ |

### Profile Management

| Action | Admin | Moderators | Users |
|--------|-------|------------|-------|
| View own profile | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ |
| Upload own avatar | ✅ | ✅ | ✅ |
| View other profiles | ✅ | ✅ | ✅ |
| Edit other profiles | ❌ | ❌ | ❌ |

### User Management

| Action | Admin | Moderators | Users |
|--------|-------|------------|-------|
| View user list | ✅ | ❌ | ❌ |
| Add user to group | ✅ | ❌ | ❌ |
| Remove user from group | ✅ | ❌ | ❌ |
| Disable user | ✅ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ❌ |

### Admin Dashboard

| Action | Admin | Moderators | Users |
|--------|-------|------------|-------|
| Access dashboard | ✅ | ❌ | ❌ |
| View all items | ✅ | ❌ | ❌ |
| Add annotations | ✅ | ❌ | ❌ |
| Bulk operations | ✅ | ❌ | ❌ |

### Monitoring

| Action | Admin | Moderators | Users |
|--------|-------|------------|-------|
| View metrics | ✅ | ❌ | ❌ |
| View logs | ✅ | ❌ | ❌ |
| View alarms | ✅ | ❌ | ❌ |
| Configure alerts | ✅ | ❌ | ❌ |

## 🔍 Implementation Details

### Frontend Implementation

#### **ItemCard.tsx**
```typescript
// Delete permission
const canDelete = item.userId === currentUser.sub || 
                  currentUser['cognito:groups']?.includes('Admin')

// Edit permission
const canEdit = onUpdate && (
  (item.type === 'task' && (
    item.userId === currentUser.sub || 
    item.userId === currentUser.id || 
    currentUser['cognito:groups']?.includes('Admin')
  )) ||
  (item.type === 'announcement' && (
    currentUser['cognito:groups']?.includes('Admin') || 
    currentUser['cognito:groups']?.includes('Moderators')
  ))
)
```

**Status**: ⚠️ **ISSUE DETECTED**
- Tasks: Moderators cannot edit/delete other users' tasks (should be able to)
- Logic only checks `Admin` group, not `Moderators`

#### **AnnouncementsPage.tsx**
```typescript
// Create/manage permission
const canCreateAnnouncement = user?.['cognito:groups']?.some(
  (group) => group === 'Admin' || group === 'Moderators'
)
```

**Status**: ✅ Correct implementation

#### **AdminDashboard.tsx**
```typescript
useEffect(() => {
  if (user) {
    const groups = user['cognito:groups'] || []
    setIsAdmin(groups.includes('Admin'))
  }
}, [user])
```

**Status**: ✅ Correct implementation

### Backend Implementation

#### **services/items/index.js**
```javascript
// Delete permission check
const groups = user.groups || [];
const isAdmin = groups.includes('Admin');

if (!isAdmin) {
  // Check ownership for non-admin users
  const queryCommand = new QueryCommand({...});
  const queryResult = await docClient.send(queryCommand);
  if (item.userId !== user.userId) {
    return createResponse(403, { error: 'Forbidden' });
  }
}
```

**Status**: ⚠️ **ISSUE DETECTED**
- Does not check for `Moderators` group
- Moderators should be able to delete any task/announcement

#### **services/items/permissions.js**
```javascript
checkPermission(user, action, resource) {
  if (user.isAdmin) return true;
  
  switch (action) {
    case 'create:announcement':
      return user.isModerator || user.isAdmin;
    
    case 'update:task':
      return resource.userId === user.userId || user.isAdmin;
    
    case 'delete:task':
      return resource.userId === user.userId || user.isAdmin;
    
    case 'delete:announcement':
      return user.isModerator || user.isAdmin;
  }
}
```

**Status**: ⚠️ **ISSUE DETECTED**
- `update:task` and `delete:task` don't include Moderators
- Should be: `resource.userId === user.userId || user.isAdmin || user.isModerator`

#### **services/monitoring/index.js**
```javascript
function isAdmin(event) {
  const groups = event.requestContext?.authorizer?.claims?.['cognito:groups'] || '';
  return groups.includes('Admin') || groups.includes('admin');
}
```

**Status**: ✅ Correct implementation

## 🐛 Identified Issues

### 1. **Moderators Cannot Edit/Delete Other Users' Tasks**
- **Location**: `src/components/ItemCard.tsx` (line 59-67)
- **Current**: Only Admin can edit/delete other users' tasks
- **Expected**: Both Admin and Moderators should have this permission
- **Impact**: HIGH - Core functionality broken for Moderators

### 2. **Backend Delete Permission Too Restrictive**
- **Location**: `services/items/index.js` (line 303)
- **Current**: Only Admin can delete other users' items
- **Expected**: Moderators should also have this permission
- **Impact**: HIGH - Backend blocks Moderators from managing content

### 3. **Backend Update Permission Missing**
- **Location**: `services/items/index.js` (no update handler found)
- **Status**: Needs verification - update logic may be missing or inadequate
- **Impact**: MEDIUM - Cannot verify update permissions

### 4. **Permission Helper Not Used**
- **Location**: `services/items/permissions.js` vs `services/items/index.js`
- **Issue**: Permission helper exists but is not imported/used in main handler
- **Impact**: MEDIUM - Code duplication and inconsistency

## ✅ Correct Implementations

### 1. **Announcement Creation** ✅
- Frontend: `AnnouncementsPage.tsx` checks Admin/Moderators
- Backend: `permissions.js` checks Admin/Moderators

### 2. **Admin Dashboard Access** ✅
- Frontend: `AdminDashboard.tsx` restricts to Admin only
- Backend: `services/monitoring/index.js` checks Admin only

### 3. **Profile Management** ✅
- All users can manage own profile
- Backend properly restricts to authenticated user's own data

## 📝 Recommendations

### Priority 1: Fix Task Management Permissions
1. Update `ItemCard.tsx` to include Moderators in edit/delete checks
2. Update `services/items/index.js` to check for Moderators group
3. Use `permissions.js` helper instead of inline checks

### Priority 2: Add User Management UI
1. Create `UserManagement.tsx` component
2. Fetch users from Cognito using `AdminListUsersCommand`
3. Allow Admin to add/remove users from groups
4. Display in AdminDashboard

### Priority 3: Comprehensive Testing
1. Test all permissions with three different user accounts (Admin, Moderator, User)
2. Verify backend returns correct status codes (403 for forbidden actions)
3. Verify frontend hides unauthorized actions
4. Test edge cases (user without groups, expired tokens)

## 🔗 Related Files

- Frontend RBAC: `src/components/ItemCard.tsx`, `src/pages/AnnouncementsPage.tsx`, `src/pages/AdminDashboard.tsx`
- Backend RBAC: `services/items/index.js`, `services/items/permissions.js`, `services/monitoring/index.js`
- Auth: `services/auth/index.js`, `services/auth-trigger/index.js`
- Infrastructure: `infra/lib/auth-stack.ts`

## 📅 Version History

- **2024-01-XX**: Initial RBAC specification documented
- **Current Status**: Issues identified in Moderator permissions

---

**Document Status**: ⚠️ ISSUES IDENTIFIED - Requires immediate fixes to Moderator permissions
