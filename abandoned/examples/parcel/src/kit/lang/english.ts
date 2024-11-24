import { DeepOptional } from '@logos-ui/riot-kit';

export const english = {

    auth: {
        login: 'Login',
        register: 'Register',
        forgotPassword: 'Forgot Password',
        createAnAccount: 'Create an Account',
        enterOtp: 'Enter OTP',
        alreadyHaveAccount: 'Already have an account?',

        loginSuccess: 'Login Successful',
        registerSuccess: 'Register Successful',
        logoutSuccess: 'Logout Successful',

        invalidOtp: 'Invalid OTP',
        invalidUsername: 'Invalid Username',
        invalidEmail: 'Invalid email',
        badPassword: 'Bad Password',

        noRegistrationFound: 'No registration details found'
    },


    general: {

        username: 'Username',
        email: 'Email',
        password: 'Password',
        submit: 'Submit',
        tos: 'Terms of Service',
        privacyPolicy: 'Privacy Policy'
    }
};

export type LocType = DeepOptional<typeof english>;
