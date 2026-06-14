# Requirements Document

## Introduction

This feature adds user authentication to NowCart — a login/signup window with JWT-based token authentication and OTP verification. Users can create accounts, log in, and maintain authenticated sessions. The system stores user credentials and profile data in the existing data layer (DynamoDB with in-memory fallback), following the established repository pattern. Default OTPs are supported for testing and demo purposes.

## Glossary

- **Auth_Service**: The backend service responsible for user registration, login, OTP generation, OTP verification, and JWT token management.
- **Auth_Controller**: The FastAPI controller that exposes authentication-related HTTP endpoints.
- **User_Repository**: The data-access layer responsible for persisting and retrieving user credentials and profile data, extending the existing Repository protocol.
- **JWT_Token**: A JSON Web Token issued upon successful authentication, used to authorize subsequent API requests.
- **Access_Token**: A short-lived JWT_Token used to authenticate individual API requests.
- **Refresh_Token**: A longer-lived JWT_Token used to obtain new Access_Tokens without re-authentication.
- **OTP**: A one-time password sent to the user's registered phone number or email for verification during signup or login.
- **Default_OTP**: A fixed OTP value (e.g., "123456") accepted during testing and demo mode to bypass actual OTP delivery.
- **Auth_Window**: The frontend modal or page component that presents login and signup forms to the user.
- **Protected_Route**: A frontend route or backend endpoint that requires a valid JWT_Token for access.

## Requirements

### Requirement 1: User Signup

**User Story:** As a new user, I want to create an account with my phone number and basic details, so that I can access personalized features of NowCart.

#### Acceptance Criteria

1. WHEN a user submits a signup form with a valid phone number (10-digit Indian mobile number starting with 6–9) and a name between 1 and 100 characters, THE Auth_Service SHALL create a new user record and initiate OTP verification.
2. WHEN a signup request is received with a phone number that already exists, THE Auth_Service SHALL return an error indicating the account already exists and SHALL NOT create a duplicate record.
3. IF a signup form is submitted with a phone number that is empty or does not match the 10-digit format starting with 6–9, THEN THE Auth_Window SHALL display an inline validation error indicating the expected phone number format and SHALL NOT call the Auth_Service.
4. IF a signup form is submitted with a name field that is empty or contains only whitespace, THEN THE Auth_Window SHALL display an inline validation error indicating that a name is required and SHALL NOT call the Auth_Service.
5. WHEN a user record is created, THE User_Repository SHALL persist the user data (user_id, name, phone_number, created_at) in the configured data backend.
6. IF OTP delivery fails after the user record is created, THEN THE Auth_Service SHALL inform the user that verification could not be completed and SHALL allow the user to retry OTP delivery without re-submitting the signup form.

### Requirement 2: OTP Verification

**User Story:** As a user signing up or logging in, I want to verify my identity via a one-time password, so that my account remains secure.

#### Acceptance Criteria

1. WHEN the Auth_Service initiates OTP verification, THE Auth_Service SHALL generate a 6-digit numeric OTP and associate it with the user's phone number with a 5-minute expiry.
2. WHEN a user submits a valid OTP within the expiry window, THE Auth_Service SHALL mark the verification as successful and return a success response to the calling flow (signup or login).
3. WHEN a user submits an incorrect OTP, THE Auth_Service SHALL return a verification failure error and increment the failed attempt count for that verification session.
4. IF a user has submitted 5 consecutive incorrect OTPs for the same verification session, THEN THE Auth_Service SHALL lock the verification session, reject further attempts, and require the user to request a new OTP.
5. WHEN an OTP has expired, THE Auth_Service SHALL return an expiry error and allow the user to request a new OTP.
6. IF the application is running in dev or demo mode, THEN THE Auth_Service SHALL accept the Default_OTP value "123456" as a valid OTP for all phone numbers.
7. WHEN a user requests OTP resend, THE Auth_Service SHALL generate a new OTP, invalidate the previous one, and reset the failed attempt count, subject to a maximum of 3 resends per verification session with a minimum interval of 30 seconds between resend requests.
8. WHILE the OTP input is displayed, THE Auth_Window SHALL show the remaining time before expiry, updated every 1 second.
9. WHEN an OTP input is submitted with fewer or more than 6 characters or with non-numeric characters, THE Auth_Window SHALL display an inline validation error and SHALL NOT call the Auth_Service.
10. IF the resend limit of 3 has been reached for the current verification session, THEN THE Auth_Window SHALL disable the resend option and display a message indicating the limit has been reached.

### Requirement 3: User Login

**User Story:** As a returning user, I want to log in with my phone number and OTP, so that I can access my account and saved preferences.

#### Acceptance Criteria

1. WHEN a user submits a login request with a registered phone number, THE Auth_Service SHALL initiate OTP verification by sending a 6-digit numeric code to that phone number, valid for 300 seconds from issuance.
2. WHEN a user submits a login request with an unregistered phone number, THE Auth_Service SHALL return an error indicating the account does not exist.
3. WHEN OTP verification succeeds during login, THE Auth_Service SHALL issue an Access_Token with an expiration of 30 minutes and a Refresh_Token with an expiration of 7 days.
4. WHEN a login form is submitted with a phone number that is empty or does not match a 10-digit numeric format (optionally prefixed with a country code of 1 to 3 digits), THE Auth_Window SHALL display an inline validation error indicating the expected format and SHALL NOT call the Auth_Service.
5. IF a user submits an incorrect OTP or the OTP has expired, THEN THE Auth_Service SHALL return an error indicating the verification failed and SHALL NOT issue any tokens.
6. IF a user fails OTP verification 5 consecutive times for the same phone number, THEN THE Auth_Service SHALL block further OTP attempts for that phone number for 15 minutes.
7. IF the OTP delivery service is unavailable, THEN THE Auth_Service SHALL return an error indicating that login is temporarily unavailable and the user should retry later.

### Requirement 4: JWT Token Management

**User Story:** As an authenticated user, I want my session maintained securely via tokens, so that I do not have to log in repeatedly.

#### Acceptance Criteria

1. WHEN authentication succeeds, THE Auth_Service SHALL issue an Access_Token with a 30-minute expiry and a Refresh_Token with a 7-day expiry.
2. WHEN an Access_Token expires, THE Auth_Window SHALL use the Refresh_Token to obtain a new Access_Token without user interaction, and the refresh request SHALL complete within 2 seconds.
3. WHEN a Refresh_Token is used to obtain a new Access_Token, THE Auth_Service SHALL validate the Refresh_Token by verifying its signature, confirming it has not expired, and confirming it has not been revoked, and upon successful validation SHALL issue a new Access_Token.
4. IF the silent token refresh fails due to a network error or server unavailability, THEN THE Auth_Window SHALL retry the refresh request up to 3 times with exponential backoff before redirecting the user to the login screen.
5. WHEN a Refresh_Token has expired or fails validation, THE Auth_Service SHALL return an unauthorized error and THE Auth_Window SHALL clear stored tokens and redirect the user to the login screen.
6. WHEN a JWT_Token is issued, THE Auth_Service SHALL sign it using a server-side secret key configured via environment variable.
7. WHEN a protected endpoint receives a request, THE Auth_Service SHALL extract the Access_Token from the Authorization header using the Bearer scheme and SHALL validate the token signature and expiry before processing the request.
8. IF a request to a protected endpoint contains an invalid, expired, or missing Access_Token in the Authorization header, THEN THE Auth_Controller SHALL return a 401 Unauthorized response with an error message indicating the reason for rejection.
9. WHEN a new Refresh_Token is issued, THE Auth_Service SHALL revoke the previously issued Refresh_Token for that user session so that each Refresh_Token is single-use.

### Requirement 5: Authentication UI (Auth_Window)

**User Story:** As a user, I want a clean and intuitive login/signup interface, so that I can authenticate quickly and start shopping.

#### Acceptance Criteria

1. WHEN the Auth_Window is opened, THE Auth_Window SHALL display a tabbed interface with Login and Signup options, where the Login tab contains a phone number field and the Signup tab contains name and phone number fields.
2. WHEN a user switches between Login and Signup tabs, THE Auth_Window SHALL update the form fields without a page reload, clearing any previously entered data and validation messages.
3. WHEN OTP verification is initiated, THE Auth_Window SHALL transition to an OTP input screen with 6 individual digit fields that each accept a single numeric character (0–9), and SHALL display a countdown timer starting at 300 seconds after which a "Resend OTP" option becomes available.
4. WHILE an authentication request is in progress, THE Auth_Window SHALL display a loading indicator and disable the submit button to prevent duplicate submissions.
5. WHEN an authentication error occurs, THE Auth_Window SHALL display the error message inline below the relevant form field without closing the window, and SHALL preserve any user-entered data.
6. WHEN authentication succeeds, THE Auth_Window SHALL close and update the application header to show the logged-in user's name, truncated to 20 characters with an ellipsis if longer.
7. WHERE the viewport width is below 768px, THE Auth_Window SHALL render as a full-screen overlay instead of a centered modal.
8. WHEN a user clicks a "Login" or "Sign Up" button in the application header, THE Auth_Window SHALL open as a modal overlay with the corresponding tab pre-selected.
9. IF a user submits a form with missing or invalid required fields, THEN THE Auth_Window SHALL display inline validation messages indicating each invalid field and SHALL NOT send an authentication request.
10. WHEN the Auth_Window is open, THE Auth_Window SHALL provide a visible close button that dismisses the modal without triggering authentication, returning focus to the element that opened it.
11. IF a user enters an incorrect OTP, THEN THE Auth_Window SHALL display an inline error message indicating the code is invalid and SHALL allow the user to re-enter the code without restarting the flow, for up to 5 attempts before requiring a new OTP to be requested.

### Requirement 6: Session Persistence and Logout

**User Story:** As a user, I want my login session to persist across browser refreshes and have the ability to log out, so that I have a seamless yet controllable experience.

#### Acceptance Criteria

1. WHEN an Access_Token and Refresh_Token are issued, THE Auth_Window SHALL store them in browser localStorage.
2. WHEN the application loads, THE Auth_Window SHALL check localStorage for an Access_Token, verify that its expiry claim is in the future, and restore the authenticated state if the token is non-expired.
3. WHEN a user initiates logout, THE Auth_Service SHALL invalidate the Refresh_Token on the server side.
4. IF the server-side Refresh_Token invalidation request fails due to a network or server error, THEN THE Auth_Window SHALL still clear local tokens and reset the UI to an unauthenticated state, and SHALL display an error message indicating the session may remain active on the server.
5. WHEN a user initiates logout successfully, THE Auth_Window SHALL clear stored tokens from localStorage and reset the UI to an unauthenticated state showing the login entry point.
6. WHEN tokens are sent with API requests, THE Auth_Window SHALL attach the Access_Token as a Bearer token in the Authorization header.
7. WHEN an API request receives a 401 Unauthorized response indicating an expired Access_Token, THE Auth_Window SHALL attempt to obtain a new Access_Token using the stored Refresh_Token before retrying the original request once.
8. IF a token refresh attempt fails or no Refresh_Token is available, THEN THE Auth_Window SHALL clear stored tokens, reset the UI to an unauthenticated state, and prompt the user to log in again.

### Requirement 7: User Data Storage

**User Story:** As the platform, I need user authentication data stored securely and consistently with the existing data architecture, so that the authentication system integrates cleanly with NowCart's infrastructure.

#### Acceptance Criteria

1. WHEN user data is persisted, THE User_Repository SHALL store it in the configured data backend (DynamoDB or in-memory) following the existing repository pattern by implementing the Repository protocol's `get_user` and `upsert_user` methods.
2. WHEN user credentials are stored, THE Auth_Service SHALL hash the OTP verification codes using a one-way hash before persisting them for audit purposes.
3. WHEN the data backend is DynamoDB, THE User_Repository SHALL store user authentication records in the existing "NowCart_Users" table with user_id as the partition key, adding authentication fields (phone_number, hashed_otp, last_login) to the user record.
4. WHEN the data backend is set to "memory", THE User_Repository SHALL fall back to an in-memory dictionary so the application still runs without external infrastructure.
5. THE User_Repository SHALL never store raw OTP values beyond the active verification session, and SHALL discard them no later than 10 minutes after generation.
6. WHEN a user authenticates successfully, THE Auth_Service SHALL update the user's last_login timestamp as an ISO 8601 UTC value in the User_Repository.
7. IF the data backend fails to persist user authentication data, THEN THE User_Repository SHALL raise an error indicating the persistence failure without exposing internal backend details, and SHALL NOT leave the user record in a partially updated state.
8. IF a user record already exists when new authentication credentials are stored, THEN THE User_Repository SHALL update only the authentication fields without overwriting existing non-auth user data (name, email, preferences).
