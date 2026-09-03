from pydantic import BaseModel


class ConfigFieldOut(BaseModel):
    category: str
    name: str
    key: str  # f"{category}.{name}" — convenience for the frontend
    type: str  # ConfigType value: "string" | "number" | "boolean" | "filesize" | "enum"
    # Effective value: DB override if one exists, else the env-resolved
    # settings.<attr> default. None only for an obscured field whose stored
    # ciphertext failed to decrypt (JWT_SECRET rotated since it was saved).
    value: str | int | bool | None
    is_overridden: bool  # a configs row exists for this key, vs. following its env default
    obscured: bool
    locked: bool
    choices: list[str] | None = None  # only set for type == "enum"


class ConfigFieldIn(BaseModel):
    key: str
    value: str | int | bool | None = None


class ConfigBulkUpdate(BaseModel):
    items: list[ConfigFieldIn]
