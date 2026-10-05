from rest_framework import serializers

from common.validation import EmailField, PasswordField, required_messages


class LoginSerializer(serializers.Serializer):
    email = EmailField()
    password = serializers.CharField(trim_whitespace=False, error_messages=required_messages('Password'))


class ForgotPasswordSerializer(serializers.Serializer):
    email = EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(error_messages=required_messages('Reset token'))
    password = PasswordField()


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(trim_whitespace=False, error_messages=required_messages('Current password'))
    newPassword = PasswordField()
