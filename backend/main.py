from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import jwt
import os
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import uuid
import json
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Configuration
DATABASE_URL = "sqlite:///./community_pulse.db"
SECRET_KEY = "your-secret-key-for-jwt-token"  # Change this in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Create app
app = FastAPI(title="Community Pulse API")

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:3000",  # NextJS default port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    password_hash = Column(String)
    is_admin = Column(Boolean, default=False)
    is_verified_organizer = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_banned = Column(Boolean, default=False)
    
    # Relationships
    events = relationship("Event", back_populates="organizer")
    event_registrations = relationship("EventRegistration", back_populates="user")

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    location = Column(String)
    category = Column(String, index=True)
    start_date = Column(DateTime, index=True)
    end_date = Column(DateTime, index=True)
    registration_start = Column(DateTime)
    registration_end = Column(DateTime)
    image_path = Column(String, nullable=True)
    organizer_id = Column(Integer, ForeignKey("users.id"))
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organizer = relationship("User", back_populates="events")
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")

class EventRegistration(Base):
    __tablename__ = "event_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    attendee_name = Column(String)
    attendee_email = Column(String)
    attendee_phone = Column(String)
    number_of_attendees = Column(Integer, default=1)
    registered_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event = relationship("Event", back_populates="registrations")
    user = relationship("User", back_populates="event_registrations")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    notification_type = Column(String)  # "reminder", "update", "cancellation"
    created_at = Column(DateTime, default=datetime.utcnow)
    
# Create all tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Models (Request & Response Models)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    phone: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    phone: str
    is_admin: bool
    is_verified_organizer: bool
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class EventCreate(BaseModel):
    title: str
    description: str
    location: str
    category: str
    start_date: datetime
    end_date: datetime
    registration_start: datetime
    registration_end: datetime

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None

class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    location: str
    category: str
    start_date: datetime
    end_date: datetime
    registration_start: datetime
    registration_end: datetime
    image_path: Optional[str] = None
    organizer_id: int
    is_approved: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class EventRegistrationCreate(BaseModel):
    attendee_name: str
    attendee_email: EmailStr
    attendee_phone: str
    number_of_attendees: int = 1

class EventRegistrationResponse(BaseModel):
    id: int
    event_id: int
    user_id: Optional[int] = None
    attendee_name: str
    attendee_email: str
    attendee_phone: str
    number_of_attendees: int
    registered_at: datetime
    
    class Config:
        from_attributes = True

class AdminUserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    is_verified_organizer: Optional[bool] = None
    is_banned: Optional[bool] = None

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned from the platform"
        )
    
    return user

def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

# Auth endpoints
@app.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if username or email already exists
    db_user = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        phone=user.phone,
        password_hash=hashed_password
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@app.post("/login", response_model=Token)
def login(form_data: UserLogin, db: Session = Depends(get_db)):
    # Find user by username
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned from the platform"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# User endpoints
@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# Event endpoints
@app.post("/events", response_model=EventResponse)
async def create_event(
    title: str = Form(...),
    description: str = Form(...),
    location: str = Form(...),
    category: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    registration_start: str = Form(...),
    registration_end: str = Form(...),
    image: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Parse datetime strings
    start_date_dt = datetime.fromisoformat(start_date)
    end_date_dt = datetime.fromisoformat(end_date)
    registration_start_dt = datetime.fromisoformat(registration_start)
    registration_end_dt = datetime.fromisoformat(registration_end)
    
    # Create event
    db_event = Event(
        title=title,
        description=description,
        location=location,
        category=category,
        start_date=start_date_dt,
        end_date=end_date_dt,
        registration_start=registration_start_dt,
        registration_end=registration_end_dt,
        organizer_id=current_user.id,
        is_approved=current_user.is_verified_organizer  # Auto-approve for verified organizers
    )
    
    # Handle image upload if provided
    if image:
        # Create a unique filename
        file_extension = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_location = f"uploads/{filename}"
        
        # Save the file
        with open(file_location, "wb") as file_object:
            shutil.copyfileobj(image.file, file_object)
        
        db_event.image_path = file_location
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    return db_event

@app.get("/events", response_model=List[EventResponse])
def get_events(
    category: Optional[str] = None,
    upcoming: bool = False,
    approved_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    
    # Filter by approval status
    if approved_only:
        query = query.filter(Event.is_approved == True)
    
    # Filter by category if provided
    if category:
        query = query.filter(Event.category == category)
    
    # Filter for upcoming events
    if upcoming:
        query = query.filter(Event.start_date >= datetime.utcnow())
    
    # Sort by start date
    events = query.order_by(Event.start_date).all()
    
    return events

@app.get("/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    return event

@app.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    registration_start: Optional[str] = Form(None),
    registration_end: Optional[str] = Form(None),
    image: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is organizer or admin
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event"
        )
    
    # Update fields if provided
    if title:
        event.title = title
    if description:
        event.description = description
    if location:
        event.location = location
    if category:
        event.category = category
    if start_date:
        event.start_date = datetime.fromisoformat(start_date)
    if end_date:
        event.end_date = datetime.fromisoformat(end_date)
    if registration_start:
        event.registration_start = datetime.fromisoformat(registration_start)
    if registration_end:
        event.registration_end = datetime.fromisoformat(registration_end)
    
    # Non-verified organizers need re-approval after updates
    if not current_user.is_verified_organizer and not current_user.is_admin:
        event.is_approved = False
    
    # Handle image upload if provided
    if image:
        # Delete old image if exists
        if event.image_path and os.path.exists(event.image_path):
            os.remove(event.image_path)
        
        # Create a unique filename
        file_extension = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_location = f"uploads/{filename}"
        
        # Save the file
        with open(file_location, "wb") as file_object:
            shutil.copyfileobj(image.file, file_object)
        
        event.image_path = file_location
    
    # Update timestamp
    event.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(event)
    
    # Create notifications for registered users about event update
    for registration in event.registrations:
        notification = Notification(
            event_id=event.id,
            user_id=registration.user_id,
            title="Event Updated",
            message=f"The event '{event.title}' you registered for has been updated.",
            notification_type="update"
        )
        db.add(notification)
    
    db.commit()
    
    return event

@app.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is organizer or admin
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this event"
        )
    
    # Create cancellation notifications for registered users
    for registration in event.registrations:
        notification = Notification(
            event_id=event.id,
            user_id=registration.user_id,
            title="Event Cancelled",
            message=f"The event '{event.title}' has been cancelled.",
            notification_type="cancellation"
        )
        db.add(notification)
    
    # Delete the event image if it exists
    if event.image_path and os.path.exists(event.image_path):
        try:
            os.remove(event.image_path)
        except:
            pass
    
    # Delete the event
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}

# Event Registration endpoints
@app.post("/events/{event_id}/register", response_model=EventRegistrationResponse)
def register_for_event(
    event_id: int,
    registration: EventRegistrationCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not event.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register for an unapproved event"
        )
    
    # Check if registration period is open
    now = datetime.utcnow()
    if now < event.registration_start or now > event.registration_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is not open for this event"
        )
    
    # Check if already registered
    existing_registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.attendee_email == registration.attendee_email
    ).first()
    
    if existing_registration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered for this event"
        )
    
    # Create registration
    db_registration = EventRegistration(
        event_id=event_id,
        user_id=current_user.id if current_user else None,
        attendee_name=registration.attendee_name,
        attendee_email=registration.attendee_email,
        attendee_phone=registration.attendee_phone,
        number_of_attendees=registration.number_of_attendees
    )
    
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    
    # Create reminder notification
    if current_user:
        reminder_date = event.start_date - timedelta(days=1)
        if reminder_date > now:
            notification = Notification(
                event_id=event.id,
                user_id=current_user.id,
                title="Event Reminder",
                message=f"Reminder: The event '{event.title}' is tomorrow!",
                notification_type="reminder"
            )
            db.add(notification)
            db.commit()
    
    return db_registration

@app.get("/events/{event_id}/registrations", response_model=List[EventRegistrationResponse])
def get_event_registrations(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is organizer or admin
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view registrations"
        )
    
    registrations = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id
    ).all()
    
    return registrations

# Admin endpoints
@app.get("/admin/events/pending", response_model=List[EventResponse])
def get_pending_events(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.is_approved == False).all()
    return events

@app.put("/admin/events/{event_id}/approve")
def approve_event(
    event_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.is_approved = True
    db.commit()
    
    return {"message": "Event approved successfully"}

@app.put("/admin/events/{event_id}/reject")
def reject_event(
    event_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Option 1: Delete the event
    db.delete(event)
    db.commit()
    
    return {"message": "Event rejected and deleted successfully"}

@app.get("/admin/users", response_model=List[UserResponse])
def get_all_users(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

@app.put("/admin/users/{user_id}")
def update_user_status(
    user_id: int,
    user_update: AdminUserUpdate,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_update.is_admin is not None:
        user.is_admin = user_update.is_admin
    
    if user_update.is_verified_organizer is not None:
        user.is_verified_organizer = user_update.is_verified_organizer
    
    if user_update.is_banned is not None:
        user.is_banned = user_update.is_banned
    
    db.commit()
    
    return {"message": "User updated successfully"}

@app.get("/admin/events/user/{user_id}", response_model=List[EventResponse])
def get_user_events(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.organizer_id == user_id).all()
    return events

# My events endpoint (for users to see their own events)
@app.get("/my-events", response_model=List[EventResponse])
def get_my_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.organizer_id == current_user.id).all()
    return events

# My registrations endpoint
@app.get("/my-registrations", response_model=List[EventRegistrationResponse])
def get_my_registrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    registrations = db.query(EventRegistration).filter(
        EventRegistration.user_id == current_user.id
    ).all()
    
    return registrations

# Notifications endpoints
@app.get("/notifications")
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).order_by(Notification.created_at.desc()).all()
    
    return notifications

@app.put("/notifications/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    notification.is_read = True
    db.commit()
    
    return {"message": "Notification marked as read"}

# Search events endpoint
@app.get("/search", response_model=List[EventResponse])
def search_events(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(
        Event.is_approved == True,
        (
            Event.title.ilike(f"%{query}%") |
            Event.description.ilike(f"%{query}%") |
            Event.location.ilike(f"%{query}%") |
            Event.category.ilike(f"%{query}%")
        )
    ).order_by(Event.start_date).all()
    
    return events

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)